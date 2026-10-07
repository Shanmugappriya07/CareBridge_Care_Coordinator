async function checkAssets() {
  const htmlRes = await fetch('http://localhost:8085/index.html');
  const html = await htmlRes.text();
  console.log('index.html status:', htmlRes.status, 'length:', html.length);
  console.log('Includes transferModal:', html.includes('id="transferModal"'));
  console.log('Includes transferDept:', html.includes('id="transferDept"'));
  console.log('Includes transferRoom:', html.includes('id="transferRoom"'));
  console.log('Includes billRoomRentHelper:', html.includes('id="billRoomRentHelper"'));
  console.log('Includes handleBillCategoryChange:', html.includes('handleBillCategoryChange()'));

  const jsRes = await fetch('http://localhost:8085/hms_app.js');
  const js = await jsRes.text();
  console.log('hms_app.js status:', jsRes.status, 'length:', js.length);
  console.log('Includes data-transfer-admission:', js.includes('data-transfer-admission'));
  console.log('Includes openTransferModal:', js.includes('openTransferModal'));
  console.log('Includes confirmAdmissionTransfer:', js.includes('confirmAdmissionTransfer'));
  console.log('Includes updateBillRoomRentState:', js.includes('updateBillRoomRentState'));
  console.log('Includes handleBillCategoryChange:', js.includes('handleBillCategoryChange'));

  const snapRes = await fetch('http://localhost:8080/api/hms/data');
  const snap = await snapRes.json();
  console.log('api/hms/data status:', snapRes.status);
  console.log('Active patients count in snapshot:', snap.patients.filter(p => p.status === 'ACTIVE' || p.status === 'ADMITTED').length);
}

checkAssets();
