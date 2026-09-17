param(
    [int]$Port = 12697,
    [string]$OutputDir = (Join-Path $PSScriptRoot '..\..\artifacts')
)

$ErrorActionPreference = 'Stop'
$script:NextCdpId = 100
$script:SessionSocket = $null
$remoteUri = [Uri]("ws://127.0.0.1:{0}/" -f $Port)
$restartButton = 'Button-' + [char]0x91CD + [char]0x5F00
$addShelfButton = 'Button-' + [char]0x52A0 + [char]0x8D27 + [char]0x67B6
$shuffleButton = 'Button-' + [char]0x6253 + [char]0x4E71
$undoButton = 'Button-' + [char]0x64A4 + [char]0x56DE

function New-CdpConnection {
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync($remoteUri, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    return $socket
}

function Get-CdpSession {
    if (
        $null -eq $script:SessionSocket -or
        $script:SessionSocket.State -ne [System.Net.WebSockets.WebSocketState]::Open
    ) {
        $script:SessionSocket = New-CdpConnection
    }
    return $script:SessionSocket
}

function Close-CdpSession {
    if ($null -ne $script:SessionSocket) {
        $script:SessionSocket.Abort()
        $script:SessionSocket.Dispose()
        $script:SessionSocket = $null
    }
}

function Send-CdpCommand {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [int]$Id,
        [string]$Method,
        $Params
    )

    $payload = @{ id = $Id; method = $Method }
    if ($null -ne $Params) {
        $payload.params = $Params
    }

    $json = $payload | ConvertTo-Json -Depth 12 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $Socket.SendAsync(
        $segment,
        [System.Net.WebSockets.WebSocketMessageType]::Text,
        $true,
        [System.Threading.CancellationToken]::None
    ).GetAwaiter().GetResult() | Out-Null
}

function Receive-CdpResponse {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [int]$Id,
        [int]$TimeoutSeconds = 8
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $remaining = $deadline - (Get-Date)
        $milliseconds = [Math]::Max(1, [Math]::Min(1500, [int]$remaining.TotalMilliseconds))
        $cancellation = [System.Threading.CancellationTokenSource]::new(
            [TimeSpan]::FromMilliseconds($milliseconds)
        )
        try {
            $buffer = New-Object byte[] 2097152
            $segment = [System.ArraySegment[byte]]::new($buffer)
            $result = $Socket.ReceiveAsync($segment, $cancellation.Token).GetAwaiter().GetResult()
            $text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
            try {
                $response = $text | ConvertFrom-Json -ErrorAction Stop
                if ($response.id -eq $Id) {
                    return $response
                }
            } catch {
            }
        } catch [System.OperationCanceledException] {
        } finally {
            $cancellation.Dispose()
        }
    }

    throw "Timed out waiting for CDP response id=$Id"
}

function Invoke-CdpCommand {
    param(
        [string]$Method,
        $Params,
        [int]$TimeoutSeconds = 8
    )

    $socket = Get-CdpSession
    $id = $script:NextCdpId
    $script:NextCdpId += 1
    Send-CdpCommand -Socket $socket -Id $id -Method $Method -Params $Params
    return Receive-CdpResponse -Socket $socket -Id $id -TimeoutSeconds $TimeoutSeconds
}

function Invoke-RuntimeExpression {
    param(
        [int]$ContextId,
        [string]$Expression
    )

    $response = Invoke-CdpCommand -Method 'Runtime.evaluate' -Params @{
        expression = $Expression
        returnByValue = $true
        contextId = $ContextId
    }

    if ($response.error) {
        throw "Runtime evaluate CDP error: $($response.error | ConvertTo-Json -Compress)"
    }
    if ($response.result.exceptionDetails) {
        throw "Runtime expression failed: $($response.result.exceptionDetails | ConvertTo-Json -Depth 8 -Compress)"
    }
    return $response.result.result.value
}

function Find-ContextId {
    param([string]$Predicate)

    foreach ($contextId in 1..20) {
        try {
            $value = Invoke-RuntimeExpression -ContextId $contextId -Expression $Predicate
            if ($value -eq $true) {
                return $contextId
            }
        } catch {
        }
    }
    throw "Unable to find remote runtime context: $Predicate"
}

function Get-GameSnapshot {
    param([int]$ContextId)

    $expression = @'
JSON.stringify((function () {
  const canvas = cc.director.getScene().getChildByName('Canvas');
  const bootstrap = canvas.getComponent('GameBootstrap');
  const snapshot = bootstrap.controller.getSnapshot();
  const top = (shelf) => {
    for (let index = shelf.slots.length - 1; index >= 0; index -= 1) {
      if (shelf.slots[index]) {
        return shelf.slots[index];
      }
    }
    return null;
  };
  const signature = snapshot.board.shelves
    .map((shelf) => shelf.id + ':' + shelf.slots
      .map((slot) => slot ? (slot.hidden ? 'box' : slot.tokenId) : '-')
      .join(','))
    .join('|');
  return {
    levelId: snapshot.levelId,
    message: snapshot.message,
    selectedShelfId: snapshot.selectedShelfId,
    canUndo: snapshot.canUndo,
    bufferShelfCount: snapshot.bufferShelfCount,
    isWon: snapshot.isWon,
    signature,
    shelves: snapshot.board.shelves.map((shelf) => ({
      id: shelf.id,
      kind: shelf.kind,
      capacity: shelf.capacity,
      count: shelf.slots.filter(Boolean).length,
      top: top(shelf)
    }))
  };
})())
'@

    $json = Invoke-RuntimeExpression -ContextId $ContextId -Expression $expression
    return $json | ConvertFrom-Json
}

function Get-UiTapPoint {
    param(
        [int]$ContextId,
        [string]$NodeName
    )

    $escapedName = $NodeName | ConvertTo-Json -Compress
    $expression = @"
JSON.stringify((function () {
  const canvas = cc.director.getScene().getChildByName('Canvas');
  const boardRoot = canvas.getChildByName('BoardRoot');
  const node = canvas.getChildByName($escapedName) || (boardRoot && boardRoot.getChildByName($escapedName));
  if (!node) {
    throw new Error('Node not found: ' + $escapedName);
  }
  const camera = canvas.getChildByName('Camera').getComponent('cc.Camera');
  const screen = camera.worldToScreen(node.worldPosition);
  const viewport = cc.view.getViewportRect();
  const offsetY = 44;
  return {
    x: Math.round(screen.x),
    y: Math.round(viewport.height - screen.y + offsetY),
    screenY: screen.y,
    offsetY,
    innerHeight: window.innerHeight,
    viewportHeight: viewport.height
  };
})())
"@

    $json = Invoke-RuntimeExpression -ContextId $ContextId -Expression $expression
    return $json | ConvertFrom-Json
}

function Invoke-TouchPoint {
    param(
        [int]$X,
        [int]$Y
    )

    $socket = Get-CdpSession
    $startId = $script:NextCdpId
    $script:NextCdpId += 1
    Send-CdpCommand -Socket $socket -Id $startId -Method 'Input.dispatchTouchEvent' -Params @{
        type = 'touchStart'
        touchPoints = @(@{
            x = $X
            y = $Y
            radiusX = 2
            radiusY = 2
            force = 1
            id = 0
        })
        modifiers = 0
    }
    Receive-CdpResponse -Socket $socket -Id $startId | Out-Null

    $endId = $script:NextCdpId
    $script:NextCdpId += 1
    Send-CdpCommand -Socket $socket -Id $endId -Method 'Input.dispatchTouchEvent' -Params @{
        type = 'touchEnd'
        touchPoints = @()
        modifiers = 0
    }
    Receive-CdpResponse -Socket $socket -Id $endId | Out-Null

    Start-Sleep -Milliseconds 350
}

function Invoke-NodeTap {
    param(
        [int]$ContextId,
        [string]$NodeName
    )

    $point = Get-UiTapPoint -ContextId $ContextId -NodeName $NodeName
    Invoke-TouchPoint -X $point.x -Y $point.y
    return $point
}

function Find-LegalMove {
    param([int]$ContextId)

    $expression = @'
JSON.stringify((function () {
  const canvas = cc.director.getScene().getChildByName('Canvas');
  const snapshot = canvas.getComponent('GameBootstrap').controller.getSnapshot();
  const summary = (shelf) => {
    const index = shelf.slots.map((slot, slotIndex) => slot ? slotIndex : -1)
      .filter((slotIndex) => slotIndex >= 0)
      .pop();
    return {
      id: shelf.id,
      count: shelf.slots.filter(Boolean).length,
      top: index === undefined ? null : shelf.slots[index]
    };
  };
  for (const sourceShelf of snapshot.board.shelves) {
    const source = summary(sourceShelf);
    if (!source.top || source.top.hidden) {
      continue;
    }
    for (const targetShelf of snapshot.board.shelves) {
      if (targetShelf.id === source.id) {
        continue;
      }
      const target = summary(targetShelf);
      if (target.count >= targetShelf.capacity) {
        continue;
      }
      if (!target.top || target.top.itemTypeId === source.top.itemTypeId) {
        return {
          sourceId: source.id,
          targetId: target.id,
          sourceTop: source.top.itemTypeId,
          targetTop: target.top ? target.top.itemTypeId : null,
          sourceCount: source.count,
          targetCount: target.count
        };
      }
    }
  }
  return null;
})())
'@

    $json = Invoke-RuntimeExpression -ContextId $ContextId -Expression $expression
    return $json | ConvertFrom-Json
}

function Clear-VConsole {
    param([int]$ContextId)

    $result = Invoke-RuntimeExpression -ContextId $ContextId -Expression @'
(() => {
  const button = document.querySelector('.gc-filter__clear');
  if (!button) {
    return 'missing';
  }
  button.click();
  return 'cleared';
})()
'@
    if ($result -ne 'cleared') {
        throw "Unable to clear VConsole: $result"
    }
}

function Get-VConsoleEntries {
    param([int]$ContextId)

    $json = Invoke-RuntimeExpression -ContextId $ContextId -Expression @'
JSON.stringify(Array.from(document.querySelectorAll('.luna-console-log-cont')).map((entry) => ({
  className: entry.className,
  text: entry.innerText
})))
'@
    return @($json | ConvertFrom-Json)
}

function Capture-RemoteScreenshot {
    param([string]$Path)

    $response = Invoke-CdpCommand -Method 'Page.captureScreenshot' -Params @{
        format = 'png'
        fromSurface = $true
    } -TimeoutSeconds 12
    [System.IO.File]::WriteAllBytes($Path, [Convert]::FromBase64String($response.result.data))
}

function Assert-Check {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Detail
    )

    if (-not $Condition) {
        throw "$Name failed: $Detail"
    }
}

$checks = New-Object System.Collections.Generic.List[object]
$reportPath = Join-Path $OutputDir 'wechat-pc-remote-core-regression.json'
$screenshotPath = Join-Path $OutputDir 'wechat-pc-remote-core-regression.png'
$screenshotStatus = 'NOT TESTED'
$screenshotError = $null

try {
    $gameContextId = Find-ContextId -Predicate 'typeof wx === "object" && typeof cc === "object" && !!cc.director && !!cc.director.getScene()'
    $consoleContextId = Find-ContextId -Predicate 'document.title === "WAGameVConsole"'
    Clear-VConsole -ContextId $consoleContextId

    Invoke-NodeTap -ContextId $gameContextId -NodeName $restartButton | Out-Null
    $restart = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'restart' -Condition (
        $restart.levelId -eq 1 -and
        $restart.bufferShelfCount -eq 2 -and
        $null -eq $restart.selectedShelfId -and
        -not $restart.canUndo
    ) -Detail ($restart | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{ name = 'restart'; status = 'PASS'; state = $restart })

    Invoke-NodeTap -ContextId $gameContextId -NodeName $addShelfButton | Out-Null
    $addShelf = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'addShelf' -Condition (
        $addShelf.bufferShelfCount -eq 3 -and
        $addShelf.shelves.id -contains 'buffer-3'
    ) -Detail ($addShelf | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{ name = 'addShelf'; status = 'PASS'; state = $addShelf })

    $beforeShuffle = $addShelf
    Invoke-NodeTap -ContextId $gameContextId -NodeName $shuffleButton | Out-Null
    $afterShuffle = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'shuffle' -Condition (
        $afterShuffle.bufferShelfCount -eq 3 -and
        -not $afterShuffle.canUndo -and
        $afterShuffle.signature -ne $beforeShuffle.signature
    ) -Detail ($afterShuffle | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{ name = 'shuffle'; status = 'PASS'; state = $afterShuffle })

    $move = Find-LegalMove -ContextId $gameContextId
    if ($null -eq $move) {
        throw 'Unable to find a legal move after shuffle'
    }

    $beforeMove = Get-GameSnapshot -ContextId $gameContextId
    Invoke-NodeTap -ContextId $gameContextId -NodeName ("Shelf-{0}" -f $move.sourceId) | Out-Null
    $selectedMove = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'selectMove' -Condition ($selectedMove.selectedShelfId -eq $move.sourceId) -Detail ($selectedMove | ConvertTo-Json -Compress)

    Invoke-NodeTap -ContextId $gameContextId -NodeName ("Shelf-{0}" -f $move.targetId) | Out-Null
    $afterMove = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'move' -Condition (
        $null -eq $afterMove.selectedShelfId -and
        $afterMove.canUndo -and
        $afterMove.signature -ne $beforeMove.signature
    ) -Detail ($afterMove | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{ name = 'move'; status = 'PASS'; state = $afterMove; move = $move })

    Invoke-NodeTap -ContextId $gameContextId -NodeName $undoButton | Out-Null
    $afterUndo = Get-GameSnapshot -ContextId $gameContextId
    Assert-Check -Name 'undo' -Condition (
        $null -eq $afterUndo.selectedShelfId -and
        -not $afterUndo.canUndo -and
        $afterUndo.signature -eq $beforeMove.signature
    ) -Detail ($afterUndo | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{ name = 'undo'; status = 'PASS'; state = $afterUndo })

    $consoleEntries = Get-VConsoleEntries -ContextId $consoleContextId
    $consoleProblems = @($consoleEntries | Where-Object {
        $_.className -match 'error|warn' -or $_.text -match '(^|\s)(Error|WARN)'
    })
    Assert-Check -Name 'console' -Condition ($consoleProblems.Count -eq 0) -Detail ($consoleProblems | ConvertTo-Json -Compress)
    $checks.Add([pscustomobject]@{
        name = 'console'
        status = 'PASS'
        entries = $consoleEntries.Count
        problems = $consoleProblems.Count
    })

    Close-CdpSession
    Start-Sleep -Seconds 3
    foreach ($attempt in 1..3) {
        try {
            Capture-RemoteScreenshot -Path $screenshotPath
            $screenshotStatus = 'PASS'
            $screenshotError = $null
            break
        } catch {
            $screenshotStatus = 'BLOCKED'
            $screenshotError = $_.Exception.Message
            Close-CdpSession
            if ($attempt -lt 3) {
                Start-Sleep -Seconds 2
            }
        }
    }

    $report = [ordered]@{
        status = 'PASS'
        port = $Port
        gameContextId = $gameContextId
        consoleContextId = $consoleContextId
        checks = $checks.ToArray()
        screenshotStatus = $screenshotStatus
        screenshot = $screenshotPath
        screenshotError = $screenshotError
    }
} catch {
    $report = [ordered]@{
        status = 'FAIL'
        port = $Port
        error = $_.Exception.ToString()
        stack = $_.ScriptStackTrace
        checks = $checks.ToArray()
    }
} finally {
    Close-CdpSession
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $report | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -Path $reportPath
    $report | ConvertTo-Json -Depth 12
}

if ($report.status -ne 'PASS') {
    exit 1
}
