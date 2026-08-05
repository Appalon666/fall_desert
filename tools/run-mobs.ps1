# Прогоняет все листы врагов через mob-cut.py.
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
New-Item -ItemType Directory -Force art-out\mobs | Out-Null
foreach ($k in $mirror.Keys | Sort-Object) {
  $src = "art-in\mobs\$k.jpg"
  if (-not (Test-Path $src)) { "ПРОПУЩЕН $k"; continue }
  $flag = if ($mirror[$k]) { 'mirror' } else { '' }
  python tools/mob-cut.py $src "art-out\mobs\$k.png" $flag
}
