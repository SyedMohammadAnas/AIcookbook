# Monitor Transcription Service Startup
# Run this to check when models are loaded

Write-Host "Monitoring Transcription Service..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$iteration = 0

while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "HH:mm:ss"

    # Check CPU usage
    $stats = docker stats recipe-extractor-transcription --no-stream --format "{{.CPUPerc}}" 2>$null

    # Try health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            Write-Host "[$timestamp] ✅ SERVICE READY!" -ForegroundColor Green
            Write-Host ""
            $content = $response.Content | ConvertFrom-Json
            Write-Host "Response: $($content | ConvertTo-Json)" -ForegroundColor Green
            Write-Host ""
            Write-Host "Models are loaded! You can now transcribe videos." -ForegroundColor Green
            break
        }
    }
    catch {
        Write-Host "[$timestamp] ⏳ Loading... (CPU: $stats, Attempt: $iteration)" -ForegroundColor Yellow
    }

    Start-Sleep -Seconds 10
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Place a video: Copy-Item your-video.mp4 E:\media-store\reels\test\video.mp4"
Write-Host "2. Transcribe: curl -X POST http://localhost:5000/transcribe -H 'Content-Type: application/json' -d '{\"shortcode\": \"test\"}'"
