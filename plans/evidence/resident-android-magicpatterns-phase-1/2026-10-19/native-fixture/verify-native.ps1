$ErrorActionPreference='Stop'
$base='C:/Users/User/barangayan/tmp/resident-android-magicpatterns-phase-1-20261019/native-resume'
$results=[System.Collections.Generic.List[object]]::new()
function Check([string]$name,[bool]$passed) {
  $results.Add([pscustomobject]@{check=$name;passed=$passed})
}
function Nodes([string]$name) {
  [xml]$document=Get-Content -LiteralPath (Join-Path $base "$name/ui.xml") -Raw
  return $document.SelectNodes('//node')
}
for ($cycle=1; $cycle -le 5; $cycle++) {
  $opened=if ($cycle -eq 1) {'purpose-open-default'} else {"purpose-cycle-$cycle-open"}
  $openNodes=Nodes $opened
  $closedNodes=Nodes "purpose-cycle-$cycle-closed"
  Check "production purpose cycle $cycle open" (@($openNodes | Where-Object {$_.'content-desc' -eq 'Cancel purpose selection'}).Count -eq 1)
  Check "production purpose cycle $cycle closed with no selection" ((@($closedNodes | Where-Object {$_.'content-desc' -eq 'Cancel purpose selection'}).Count -eq 0) -and (@($closedNodes | Where-Object {$_.'content-desc' -eq 'Choose a purpose'}).Count -eq 1))
  $dialogOpen=if ($cycle -eq 1) {'fixture-dialog-open'} else {"fixture-dialog-cycle-$cycle-open"}
  Check "local dialog cycle $cycle open" (@((Nodes $dialogOpen) | Where-Object {$_.text -eq 'Confirm Your Password'}).Count -eq 1)
  Check "local dialog cycle $cycle closed" (@((Nodes "fixture-dialog-cycle-$cycle-closed") | Where-Object {$_.text -eq 'Confirm Your Password'}).Count -eq 0)
}
$appearance=@{
  'fixture-1-top'='Fixture 1: light #0F6E5B system'
  'fixture-2-top'='Fixture 2: light #2563EB georgia'
  'fixture-case-3-confirmed'='Fixture 3: light #FFFFFF tahoma'
  'fixture-case-4-confirmed'='Fixture 4: dark #0F6E5B georgia'
  'fixture-case-5-confirmed'='Fixture 5: dark #000000 tahoma'
  'fixture-case-6-confirmed'='Fixture 6: dark #2563EB segoe-ui'
}
foreach ($item in $appearance.GetEnumerator()) {
  Check $item.Value (@((Nodes $item.Key) | Where-Object {$_.text -eq $item.Value}).Count -eq 1)
}
$controls=Nodes 'fixture-1-lower'
Check 'busy button exposes busy label and is disabled' (@($controls | Where-Object {$_.'content-desc' -eq 'Submit request, busy' -and $_.enabled -eq 'false'}).Count -eq 1)
Check 'disabled button is disabled' (@($controls | Where-Object {$_.'content-desc' -eq 'Disabled control' -and $_.enabled -eq 'false'}).Count -eq 1)
Check 'native reduced motion starts false' (@((Nodes 'fixture-motion-cold-ready') | Where-Object {$_.text -eq 'Native reduced motion: false'}).Count -eq 1)
Check 'native reduced motion event becomes true' (@((Nodes 'fixture-native-reduced-enabled') | Where-Object {$_.text -eq 'Native reduced motion: true'}).Count -eq 1)
foreach ($mode in @('normal','reduced')) {
  Check "$mode dialog opens" (@((Nodes "$mode-dialog-open") | Where-Object {$_.text -eq 'Confirm Your Password'}).Count -eq 1)
  Check "$mode dialog dismisses" (@((Nodes "$mode-dialog-closed") | Where-Object {$_.text -eq 'Confirm Your Password'}).Count -eq 0)
  Check "$mode sheet opens" (@((Nodes "$mode-sheet-open") | Where-Object {$_.text -eq 'Local purpose'}).Count -eq 1)
  Check "$mode sheet dismisses" (@((Nodes "$mode-sheet-closed") | Where-Object {$_.text -eq 'Local purpose'}).Count -eq 0)
}
foreach ($cycle in @(1,2)) {
  Check "background cycle $cycle returns to unsaved form" (@((Nodes "background-cycle-$cycle") | Where-Object {$_.'content-desc' -eq 'Choose a purpose'}).Count -eq 1)
}
Check 'original transition scale restored' ((Get-Content -LiteralPath "$base/original-transition-scale.txt" -Raw).Trim() -eq (Get-Content -LiteralPath "$base/restored-transition-scale.txt" -Raw).Trim())
$originalFontScale=(Get-Content -LiteralPath "$base/original-font-scale.txt" -Raw).Trim()
$restoredFontScale=(Get-Content -LiteralPath "$base/restored-font-scale.txt" -Raw).Trim()
# Android materializes the default 1.0 setting after its temporary override is removed.
$originalEffectiveScale=if ($originalFontScale -eq 'null') {1.0} else {[double]$originalFontScale}
Check 'original effective font scale restored' ($originalEffectiveScale -eq [double]$restoredFontScale)
Check 'temporary reverse mappings removed' ([string]::IsNullOrWhiteSpace((Get-Content -LiteralPath "$base/restored-reverse-mappings.txt" -Raw)))
$output=[pscustomobject]@{recordedAt=(Get-Date).ToString('o');passed=@($results | Where-Object passed).Count;failed=@($results | Where-Object {-not $_.passed}).Count;results=$results}
$output | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$base/verification.json" -Encoding utf8
$output | Select-Object passed,failed | ConvertTo-Json -Compress
if ($output.failed -gt 0) { $results | Where-Object {-not $_.passed} | Format-Table; exit 1 }
