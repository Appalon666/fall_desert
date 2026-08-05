# Прогоняет все листы врагов и боссов через конвейер целиком:
#   mob-cut.py    — вырезать фигуры и собрать лист 2x2
#   heal-slits.py — зарастить следы линии пола (см. крысиный король, мать, кувалда)
#   flip-frames.py — развернуть кадры, которые нейросеть нарисовала в другую сторону
# Результат — art-out\mobs\*.png; оттуда листы копируются в public\sprites.
#
# ВАЖНО: таблицы ниже — единственное место, где записано, что именно нужно
# каждому листу. Если правишь арт руками, а не здесь, следующий прогон это сотрёт.

# mirror — лист нарисован мордой ВПРАВО, в игре все идут влево.
$mirror = @{
  'wasp' = $true; 'crawler' = $false; 'radrat' = $false; 'ghoul' = $true
  'raider' = $true; 'dog' = $false; 'lurker' = $true; 'spitter' = $true
  'bloat' = $false; 'brute' = $true
  'new-tick' = $true; 'new-vulture' = $false; 'new-slug' = $true
  'new-butcher' = $true; 'new-roller' = $true; 'new-leech' = $true
  'new-drowned' = $true; 'new-shard' = $true
  'boss-ratking' = $false; 'boss-sledge' = $true; 'boss-mother' = $true
  'boss-tyrant' = $true; 'boss-crane' = $false; 'boss-toad' = $false
  'boss-worm' = $true; 'boss-colossus' = $true; 'boss-furnace' = $true
}

# nogrid — фигур на листе больше четырёх, резать по квадрантам нельзя
# (у слизняка нарисовано шесть поз, и в кадр попадало по полторы улитки).
$nogrid = @('new-slug')

# flips — какие кадры листа нарисованы в другую сторону, чем остальные.
# Номера кадров: 1 2 / 3 4. Проверено попарным сравнением с первым кадром.
$flips = @{
  'radrat'     = @(3, 4)
  'bloat'      = @(3)
  'new-vulture' = @(3, 4)
  'new-shard'  = @(2)
  'new-leech'  = @(4)
  'boss-toad'  = @(3, 4)
}

New-Item -ItemType Directory -Force art-out\mobs | Out-Null
foreach ($k in $mirror.Keys | Sort-Object) {
  $src = "art-in\mobs\$k.jpg"
  if (-not (Test-Path $src)) { "ПРОПУЩЕН $k"; continue }
  $dst = "art-out\mobs\$k.png"
  $flags = @()
  if ($mirror[$k]) { $flags += 'mirror' }
  if ($nogrid -contains $k) { $flags += 'nogrid' }
  python tools/mob-cut.py $src $dst @flags
  python tools/heal-slits.py $dst
  if ($flips.ContainsKey($k)) { python tools/flip-frames.py $dst @($flips[$k]) }
}

"`nГотовые листы: art-out\mobs. Разложить по игре:"
"  Get-ChildItem art-out\mobs\new-*.png  | %% { Copy-Item `$_ (`"public\sprites\`" + (`$_.Name -replace '^new-','enemy-')) -Force }"
"  Get-ChildItem art-out\mobs\boss-*.png | %% { Copy-Item `$_ `"public\sprites\`$(`$_.Name)`" -Force }"
