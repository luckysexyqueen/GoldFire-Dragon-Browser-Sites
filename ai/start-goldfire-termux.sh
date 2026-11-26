#!/data/data/com.termux/files/usr/bin/bash
set -eu
adapter=gptossuncensor20blora.gguf
model=gpt-oss-20b-UD-Q4_K_XL.gguf
work="$HOME/goldfire-gptoss"
downloads="$HOME/storage/downloads"
expected=4700f1741ae5d866fd6f16548758cf58e5cf34ed41173381e49d864d04ff97e0
mkdir -p "$work"
cd "$work"
if ! echo "$expected  $adapter" | sha256sum -c --status; then
  found=false
  for file in "$downloads"/gptossuncensor20blora*.gguf; do
    if [ -f "$file" ] && echo "$expected  $file" | sha256sum -c --status; then
      cp "$file" "$adapter"
      found=true
      break
    fi
  done
  if [ "$found" = false ]; then
    echo 'AI 연결에서 LoRA 어댑터를 다운로드 폴더에 저장하고 Termux 저장소 권한을 허용한 뒤 다시 실행하세요.'
    exit 1
  fi
fi
server=$(command -v llama-server || true)
if [ -z "$server" ]; then
  pkg update -y
  if apt-cache show llama-cpp >/dev/null 2>&1; then pkg install -y llama-cpp; fi
  server=$(command -v llama-server || true)
fi
if [ -z "$server" ]; then
  pkg install -y git cmake clang make libandroid-spawn
  [ -d llama.cpp/.git ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp.git
  cmake -S llama.cpp -B llama.cpp/build -DCMAKE_BUILD_TYPE=Release -DGGML_OPENMP=OFF -DLLAMA_BUILD_SERVER=ON -DLLAMA_OPENSSL=OFF
  cmake --build llama.cpp/build --target llama-server -j2
  server="$work/llama.cpp/build/bin/llama-server"
fi
if [ ! -s "$model" ]; then
  pkg install -y curl
  curl --fail --location --retry 3 --continue-at - --output "$model.part" "https://huggingface.co/unsloth/gpt-oss-20b-GGUF/resolve/4782614e97a6ca8b27ebf9c8916ac15f0a850887/$model"
  mv "$model.part" "$model"
fi
echo '모델을 로딩합니다. 이 터미널을 열어 두고 브라우저에서 모델 연결 확인을 누르세요.'
exec "$server" -m "$model" --lora "$adapter" --alias goldfire-gptoss-lora --host 127.0.0.1 --port 18080 -c 4096
