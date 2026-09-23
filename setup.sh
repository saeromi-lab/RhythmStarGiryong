#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=========================================="
echo " RhythmStarGiryong — 환경 설정"
echo " 경기대 스포츠리듬트레이닝(STAR) 프로그램"
echo "=========================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js가 필요합니다. https://nodejs.org 에서 설치해 주세요."
  exit 1
fi

echo "[1/3] Node.js $(node -v)"
echo "[2/3] 의존성 설치 중..."
npm install

echo "[3/3] 설정 완료"
echo ""
echo "실행 방법:"
echo "  npm run dev      # 개발 서버 (http://localhost:3000)"
echo "  npm run build    # 프로덕션 빌드"
echo "  npm start        # 개발 서버 시작"
echo ""
echo "개발 서버를 바로 시작하려면: npm run dev"
