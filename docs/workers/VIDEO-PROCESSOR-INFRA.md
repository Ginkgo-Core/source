# VIDEO-PROCESSOR-INFRA.md
## Infraestrutura do Worker de Processamento de Vídeo
### Skill nyra-content-recycler — FFmpeg + MoviePy no VPS

> **Versão:** 1.0.0  
> **Contexto:** A skill `nyra-content-recycler` processa vídeos com FFmpeg + MoviePy.  
> **Problema:** CPU/RAM intensivo. VPS de 4GB trava com 2 jobs simultâneos sem limitação.  
> **Solução:** Worker dedicado com concurrency limit + storage temporário + graceful degradation.

---

## Estimativas de Recursos por Job

```
Vídeo de 30 min (input ~500MB):

  Download (yt-dlp):
    Tempo: 2–5 min (depende da velocidade da VPS)
    RAM:   ~50MB
    Disco: ~500MB temporário

  Transcrição Whisper (API OpenAI):
    Tempo: 1–3 min
    RAM:   ~20MB (só request HTTP)
    Disco: ~0 (stream)

  Análise highlights (GPT-4o):
    Tempo: 30s
    RAM:   ~10MB
    Disco: ~0

  Cortes FFmpeg (5 clips de 30s cada):
    Tempo: 30s–2min (depende do codec)
    RAM:   ~200–400MB  ← CRÍTICO
    Disco: ~250MB (5 × 50MB)

  Auto-Editor (remove silêncios):
    Tempo: 2–5min por clip
    RAM:   ~300–500MB  ← CRÍTICO
    Disco: ~200MB (output)

  MoviePy (crop 9:16 + legendas):
    Tempo: 3–8min total
    RAM:   ~400–600MB  ← CRÍTICO
    Disco: ~200MB (output final)

TOTAL POR JOB:
  Tempo: 10–25 minutos
  RAM pico: 600–800MB
  Disco temporário: ~1–1.5GB (limpos após job)
  CPU: 80–100% por vários minutos
```

---

## Limite de Concorrência

```
VPS Hostinger KVM 4 (4GB RAM, 2 vCPU):

  RAM disponível para vídeo:
    Sistema: ~400MB
    n8n: ~300MB
    Evolution: ~200MB
    Chatwoot: ~300MB
    Redis: ~100MB
    apps/api: ~200MB
    DISPONÍVEL: ~2.5GB

  Jobs simultâneos seguros: 2
    (2 × 800MB pico = 1.6GB — margem de 900MB)

  Jobs simultâneos máximo absoluto: 3
    (risco de swap — degradação de performance)

  DECISÃO: concurrency = 2
```

---

## Docker Compose — Worker de Vídeo

```yaml
# Adicionar ao infra/docker/docker-compose.yml quando content-recycler for construído

  # ── VIDEO PROCESSOR WORKER ─────────────────────────────────────────
  video-worker:
    build:
      context: ./workers/video
      dockerfile: Dockerfile
    restart: always
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CONCURRENCY=2
      - MAX_JOB_DURATION_MS=1500000     # 25 minutos hard limit
      - TEMP_DIR=/tmp/video-processing
      - MAX_INPUT_SIZE_MB=2000          # 2GB máximo por arquivo de entrada
    volumes:
      - video-temp:/tmp/video-processing
      - video-output:/app/output
    networks:
      - ginkgo-net
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          memory: 2G        # hard limit — container é morto se passar
          cpus: '1.5'       # máximo 1.5 vCPU (deixa 0.5 para outros serviços)
        reservations:
          memory: 500M

volumes:
  video-temp:    # arquivos temporários — limpos pelo worker após job
  video-output:  # resultado final — movido para Supabase Storage após upload
```

---

## Dockerfile do Video Worker

```dockerfile
# workers/video/Dockerfile
FROM python:3.11-slim

# Instalar FFmpeg e dependências de sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Instalar Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir \
    moviepy==1.0.3 \
    auto-editor==23.47.3 \
    yt-dlp \
    supabase \
    redis \
    openai \
    bullmq

WORKDIR /app
COPY . .

CMD ["python", "worker.py"]
```

```
# workers/video/requirements.txt
moviepy==1.0.3
auto-editor==23.47.3
yt-dlp
supabase==2.0.0
redis==5.0.0
openai==1.0.0
bullmq==2.0.0
Pillow==10.0.0
numpy==1.24.0
```

---

## Worker principal (Python)

```python
# workers/video/worker.py

import os
import json
import redis
import subprocess
import tempfile
import shutil
from pathlib import Path
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
from supabase import create_client

REDIS_URL      = os.environ['REDIS_URL']
SUPABASE_URL   = os.environ['SUPABASE_URL']
SUPABASE_KEY   = os.environ['SUPABASE_SERVICE_ROLE_KEY']
CONCURRENCY    = int(os.environ.get('CONCURRENCY', 2))
MAX_DURATION   = int(os.environ.get('MAX_JOB_DURATION_MS', 1500000)) / 1000  # s
TEMP_DIR       = os.environ.get('TEMP_DIR', '/tmp/video-processing')

r       = redis.from_url(REDIS_URL)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def process_recycle_job(job: dict) -> dict:
    """
    Recebe um job de reciclagem de conteúdo e processa.
    Retorna dict com paths dos clips gerados.
    """
    tenant_id    = job['tenant_id']
    asset_id     = job['payload']['asset_id']
    source_url   = job['payload']['source_url']  # YouTube URL ou Supabase Storage URL
    clips_count  = job['payload'].get('clips_count', 5)
    output_format = job['payload'].get('format', '9:16')  # 9:16 | 1:1 | 16:9

    # Diretório temporário por job (limpeza garantida)
    job_dir = Path(TEMP_DIR) / job['id']
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        # ── 1. Atualizar status ───────────────────────────────────
        update_asset_status(tenant_id, asset_id, 'downloading')

        # ── 2. Download do vídeo ──────────────────────────────────
        input_path = job_dir / 'input.mp4'
        result = subprocess.run([
            'yt-dlp',
            '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            '--output', str(input_path),
            '--no-playlist',
            source_url
        ], timeout=300, capture_output=True)

        if result.returncode != 0:
            raise Exception(f'yt-dlp failed: {result.stderr.decode()}')

        # ── 3. Transcrição Whisper (via API) ──────────────────────
        update_asset_status(tenant_id, asset_id, 'transcribing')

        from openai import OpenAI
        client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

        with open(input_path, 'rb') as f:
            transcript = client.audio.transcriptions.create(
                model='whisper-1',
                file=f,
                response_format='verbose_json',
                timestamp_granularities=['segment']
            )

        # ── 4. Identificar highlights via GPT-4o ──────────────────
        update_asset_status(tenant_id, asset_id, 'analyzing')

        segments_text = '\n'.join([
            f"[{s['start']:.1f}s → {s['end']:.1f}s] {s['text']}"
            for s in transcript.segments
        ])

        response = client.chat.completions.create(
            model='gpt-4o',
            messages=[{
                'role': 'user',
                'content': f"""Analise esta transcrição e identifique {clips_count} momentos
                de 15–60 segundos com alto potencial de engajamento para redes sociais.
                Critérios: gancho forte, valor entregue, call to action implícito ou explícito.

                Transcrição:
                {segments_text}

                Retorne APENAS um JSON array:
                [{{"start": 0.0, "end": 45.0, "title": "título curto", "hook": "gancho do clip"}}]
                """
            }],
            response_format={'type': 'json_object'}
        )

        highlights = json.loads(response.choices[0].message.content)['clips']

        # ── 5. Cortar e processar clips ───────────────────────────
        update_asset_status(tenant_id, asset_id, 'editing')

        output_paths = []
        for i, clip_data in enumerate(highlights[:clips_count]):
            clip_path = process_single_clip(
                input_path, clip_data, job_dir, i, output_format
            )
            output_paths.append({
                'index':    i,
                'path':     str(clip_path),
                'start':    clip_data['start'],
                'end':      clip_data['end'],
                'title':    clip_data['title'],
                'hook':     clip_data['hook']
            })

        # ── 6. Upload para Supabase Storage ──────────────────────
        update_asset_status(tenant_id, asset_id, 'uploading')

        storage_urls = []
        for clip in output_paths:
            with open(clip['path'], 'rb') as f:
                storage_path = f"{tenant_id}/recycled/{asset_id}/clip_{clip['index']}.mp4"
                supabase.storage.from_('content').upload(
                    storage_path, f,
                    file_options={'content-type': 'video/mp4', 'upsert': 'true'}
                )
                public_url = supabase.storage.from_('content').get_public_url(storage_path)
                storage_urls.append({**clip, 'url': public_url})

        # ── 7. Salvar resultados no banco ─────────────────────────
        supabase.from_('recycled_content').insert([{
            'tenant_id':   tenant_id,
            'asset_id':    asset_id,
            'clip_index':  c['index'],
            'title':       c['title'],
            'hook':        c['hook'],
            'start_time':  c['start'],
            'end_time':    c['end'],
            'storage_url': c['url'],
            'status':      'ready_for_review',
            'format':      output_format
        } for c in storage_urls])

        update_asset_status(tenant_id, asset_id, 'recycled')
        return {'clips': storage_urls, 'count': len(storage_urls)}

    finally:
        # Limpar arquivos temporários SEMPRE (sucesso ou falha)
        shutil.rmtree(job_dir, ignore_errors=True)


def process_single_clip(
    input_path: Path,
    clip_data:  dict,
    job_dir:    Path,
    index:      int,
    fmt:        str
) -> Path:
    """Corta, remove silêncios, crop e adiciona legendas."""

    temp_cut     = job_dir / f'temp_cut_{index}.mp4'
    temp_edited  = job_dir / f'temp_edited_{index}.mp4'
    output_path  = job_dir / f'clip_{index}.mp4'

    # Corte com FFmpeg (mais rápido que MoviePy para cortes simples)
    subprocess.run([
        'ffmpeg', '-i', str(input_path),
        '-ss', str(clip_data['start']),
        '-to', str(clip_data['end']),
        '-c', 'copy', str(temp_cut)
    ], check=True, timeout=120)

    # Remoção de silêncios com Auto-Editor
    subprocess.run([
        'auto-editor', str(temp_cut),
        '--margin', '0.3sec',
        '--output', str(temp_edited)
    ], check=True, timeout=300)

    # Crop e legendas com MoviePy
    clip = VideoFileClip(str(temp_edited))

    if fmt == '9:16':
        w, h         = clip.size
        target_w     = int(h * 9 / 16)
        x_center     = w / 2
        clip_cropped = clip.crop(
            x1=x_center - target_w/2, y1=0,
            x2=x_center + target_w/2, y2=h
        )
    elif fmt == '1:1':
        w, h         = clip.size
        min_dim      = min(w, h)
        clip_cropped = clip.crop(
            x_center=w/2, y_center=h/2,
            width=min_dim, height=min_dim
        )
    else:  # 16:9 original
        clip_cropped = clip

    # Hook como legenda no topo
    txt = TextClip(
        clip_data['hook'][:60],  # máx 60 chars
        fontsize=42,
        color='white',
        stroke_color='black',
        stroke_width=2,
        method='caption',
        size=(clip_cropped.w - 40, None)
    ).set_position(('center', 60)).set_duration(min(3.0, clip_cropped.duration))

    final = CompositeVideoClip([clip_cropped, txt])
    final.write_videofile(
        str(output_path),
        codec='libx264',
        audio_codec='aac',
        fps=30,
        preset='fast',      # balanceamento velocidade/qualidade
        logger=None         # silenciar output verbose do MoviePy
    )
    clip.close()

    # Limpar temporários intermediários
    temp_cut.unlink(missing_ok=True)
    temp_edited.unlink(missing_ok=True)

    return output_path


def update_asset_status(tenant_id: str, asset_id: str, status: str):
    supabase.from_('knowledge_assets').update({'status': status}).eq('id', asset_id)


# ── Worker loop com concurrency ──────────────────────────────────────
if __name__ == '__main__':
    import threading
    print(f'Video worker iniciado (concurrency={CONCURRENCY})')

    def worker_thread():
        while True:
            try:
                result = r.brpop('queue:video-processing', timeout=30)
                if not result:
                    continue

                job = json.loads(result[1])
                print(f"Processando job {job['id']}")

                try:
                    output = process_recycle_job(job)
                    print(f"Job {job['id']} concluído: {output['count']} clips")

                except Exception as e:
                    job['attempts'] = job.get('attempts', 0) + 1
                    if job['attempts'] < job.get('max_attempts', 2):
                        r.lpush('queue:video-processing', json.dumps(job))
                    else:
                        r.lpush('queue:video-processing:failed', json.dumps({
                            **job,
                            'error': str(e),
                            'failed_at': __import__('datetime').datetime.utcnow().isoformat()
                        }))

            except Exception as e:
                print(f'Erro no loop: {e}')
                __import__('time').sleep(5)

    threads = [threading.Thread(target=worker_thread, daemon=True)
               for _ in range(CONCURRENCY)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
```

---

## Tabela recycled_content (migration 007 — adicionar)

```sql
-- Adicionar à migration 007_integrations.sql

CREATE TABLE recycled_content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  asset_id     UUID REFERENCES knowledge_assets(id),
  clip_index   INTEGER,
  title        TEXT,
  hook         TEXT,
  start_time   FLOAT,
  end_time     FLOAT,
  storage_url  TEXT,
  status       TEXT DEFAULT 'ready_for_review',
  -- ready_for_review | approved | scheduled | published | rejected
  format       TEXT DEFAULT '9:16',
  captions     JSONB DEFAULT '[]',   -- geradas pelo pipeline de copy
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_recycled_tenant ON recycled_content(tenant_id, status);
```

---

## Graceful Degradation

```
Se VPS não aguentar (RAM > 90%):

  1. BullMQ (quando migrado) detecta via healthcheck
  2. Jobs novos ficam na fila (não são perdidos)
  3. Worker para de aceitar novos jobs temporariamente
  4. Alerta ao operador via WhatsApp

Se job falhar após 2 tentativas:
  1. Movido para queue:video-processing:failed
  2. Incident criado no banco
  3. Cliente notificado: "Seu vídeo está sendo reprocessado"
  4. Operador pode inspecionar e reinseryr na fila manualmente

Ponto de escala (quando adicionar worker dedicado):
  Quando queue:video-processing acumular > 10 jobs regularmente
  Opção 1: Upgrade VPS para 8GB RAM (Hostinger Business)
  Opção 2: Worker separado em servidor dedicado ao vídeo
  Opção 3: Railway worker service com auto-scaling
```

---

## Checklist de implementação

```
VPS
[ ] docker-compose.yml com video-worker service
[ ] Volumes video-temp e video-output criados
[ ] Resource limits configurados (memory: 2G, cpus: 1.5)

CÓDIGO
[ ] workers/video/Dockerfile
[ ] workers/video/requirements.txt
[ ] workers/video/worker.py
[ ] process_single_clip() testado com vídeo real
[ ] Limpeza de /tmp após cada job (finally block)

BANCO
[ ] recycled_content table criada (migration 007)
[ ] knowledge_assets.status inclui valores novos:
    downloading | transcribing | analyzing | editing | uploading | recycled

STORAGE
[ ] Bucket 'content' criado no Supabase Storage
[ ] Política de acesso: leitura pública, escrita só service_role
[ ] Limite de arquivo: configurar para 500MB+

TESTE
[ ] Job com vídeo de 5min → 2 clips → sucesso
[ ] Job com vídeo de 30min → 5 clips → sucesso
[ ] 2 jobs simultâneos → sem crash de RAM
[ ] Job que falha → aparece em :failed + incident
[ ] Arquivos temporários limpos após job
```

---

*Ginkgo AI Systems — VIDEO-PROCESSOR-INFRA.md v1.0.0 — Março 2026*
