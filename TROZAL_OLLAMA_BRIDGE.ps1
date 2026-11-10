$ErrorActionPreference = "Stop"
$origin = "https://irzalbudiman2-cell.github.io"
$listen = "http://127.0.0.1:11435/"
$ollama = "http://127.0.0.1:11434"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($listen)
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$appUrl = "https://raw.githubusercontent.com/irzalbudiman2-cell/trozal-motion-web-prores/main/index.html"
$appHtml = $null
try {
  Write-Host "Mengambil TROZAL MOTION versi terbaru..." -ForegroundColor Cyan
  $appHtml = $client.GetStringAsync($appUrl).GetAwaiter().GetResult()
  if ([string]::IsNullOrWhiteSpace($appHtml)) { throw "Gagal mengambil index.html TROZAL MOTION dari GitHub." }
  $listener.Start()
  Start-Process $listen
  Write-Host ""
  Write-Host "TROZAL OLLAMA BRIDGE AKTIF" -ForegroundColor Green
  Write-Host "Browser : $listen" 
  Write-Host "TROZAL  : buka alamat Browser di atas (mode lokal tanpa izin Chrome loopback lintas situs)." -ForegroundColor Yellow
  Write-Host "Ollama  : $ollama"
  Write-Host "Jangan tutup jendela ini selama TROZAL MOTION digunakan."
  Write-Host "Tekan Ctrl+C untuk berhenti."
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers["Access-Control-Allow-Origin"] = $origin
    $res.Headers["Vary"] = "Origin"
    $res.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $res.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    $res.Headers["Access-Control-Allow-Private-Network"] = "true"
    $res.Headers["Access-Control-Max-Age"] = "600"
    try {
      if ($req.HttpMethod -eq "OPTIONS") {
        $res.StatusCode = 204
      } elseif ($req.HttpMethod -eq "GET" -and $req.Url.AbsolutePath -eq "/favicon.ico") {
        $res.StatusCode = 204
      } elseif ($req.HttpMethod -eq "GET" -and $req.Url.AbsolutePath -in @("/", "/index.html")) {
        $bytes = [Text.Encoding]::UTF8.GetBytes($appHtml)
        $res.StatusCode = 200
        $res.ContentType = "text/html; charset=utf-8"
        $res.Headers["Cache-Control"] = "no-store"
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } elseif ($req.Url.AbsolutePath -notin @("/api/tags", "/api/chat")) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('{"error":"Endpoint not allowed"}')
        $res.ContentType = "application/json; charset=utf-8"
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $method = if ($req.HttpMethod -eq "GET") { [Net.Http.HttpMethod]::Get } elseif ($req.HttpMethod -eq "POST") { [Net.Http.HttpMethod]::Post } else { $null }
        if ($null -eq $method) { throw "Method not allowed" }
        $message = [System.Net.Http.HttpRequestMessage]::new($method, ($ollama + $req.Url.AbsolutePath))
        if ($req.HttpMethod -eq "POST") {
          $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
          $body = $reader.ReadToEnd()
          $reader.Dispose()
          $message.Content = [System.Net.Http.StringContent]::new($body, [Text.Encoding]::UTF8, "application/json")
        }
        $upstream = $client.SendAsync($message).GetAwaiter().GetResult()
        $payload = $upstream.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        $res.StatusCode = [int]$upstream.StatusCode
        $res.ContentType = "application/json; charset=utf-8"
        $res.ContentLength64 = $payload.Length
        if ($payload.Length -gt 0) { $res.OutputStream.Write($payload, 0, $payload.Length) }
        $upstream.Dispose()
        $message.Dispose()
      }
    } catch {
      $res.StatusCode = 502
      $res.ContentType = "application/json; charset=utf-8"
      $err = @{ error = $_.Exception.Message } | ConvertTo-Json -Compress
      $bytes = [Text.Encoding]::UTF8.GetBytes($err)
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $res.Close()
    }
  }
} finally {
  $client.Dispose()
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}