$ErrorActionPreference = "Stop"
cd 'C:\Users\Alkin47\Videos\my web'

Write-Host "Configurando Git..."
git config user.name "ArtKing47"
git config user.email "artking47@github.com"

Write-Host "Preparando archivos..."
git add .

Write-Host "Guardando en el historial..."
try {
  git commit -m "🚀 ArtKing47 - Sitio web profesional"
} catch {
  Write-Host "Quizas ya estaban guardados."
}

Write-Host "Conectando con GitHub..."
git branch -M main
git remote remove origin 2>$null
git remote add origin https://github.com/artking47/artking47-web.git

Write-Host "Subiendo codigo (Push)... ¡Atento si te pide iniciar sesion!"
git push -u origin main
