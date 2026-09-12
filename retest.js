const http = require('http');
const io = require('socket.io-client');

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => {
        let json = null;
        try { json = JSON.parse(d); } catch {}
        res({ status: resp.statusCode, body: d, json });
      });
    });
    r.on('error', rej);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  console.log('=== RETEST START ===');
  // 1. Health
  let r = await req({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
  console.log(`1. Health: ${r.status === 200 && r.json.status==='ok' ? 'PASS' : 'FAIL'} - ${r.body.slice(0,60)}`);

  // 2. Register
  const testEmail = `retest_${Date.now()}@demo.com`;
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { name: 'Retest', email: testEmail, password: 'test1234' });
  console.log(`2. Register: ${r.status===201 ? 'PASS' : 'FAIL'} - ${r.status}`);
  const token = r.json?.token;
  const userId = r.json?.user?.id;
  if (!token) throw new Error('register failed');

  // 3. Login valid
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: testEmail, password: 'test1234' });
  console.log(`3. Login valid: ${r.status===200 ? 'PASS' : 'FAIL'}`);

  // 4. Login invalid
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: testEmail, password: 'wrong' });
  console.log(`4. Login invalid: ${r.status===401 ? 'PASS' : 'FAIL'} - ${r.status}`);

  // 5. Get profile without token
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/profile', method: 'GET' });
  console.log(`5. Profile no auth: ${r.status===401 ? 'PASS' : 'FAIL'}`);

  // 6. Get profile with token
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/profile', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`6. Profile auth: ${r.status===200 && r.json.email===testEmail ? 'PASS' : 'FAIL'}`);

  // 7. Get balance
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/balance', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`7. Balance: ${r.status===200 && r.json.balance===0 ? 'PASS' : 'FAIL'} - ${r.body.slice(0,80)}`);

  // 7b. Fund the new player via admin (no free starting coins)
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'admin@colorarena.demo', password: 'Admin123!' });
  const adminTokenEarly = r.json.token;
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/admin/users/${userId}/balance`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTokenEarly}` } }, { amount: 10000, reason: 'retest funding' });
  console.log(`7b. Fund player: ${r.status===200 ? 'PASS' : 'FAIL'}`);

  // 8. Current round
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/game/current', method: 'GET' });
  console.log(`8. Current round: ${r.status===200 && r.json.roundNumber ? 'PASS' : 'FAIL'} - #${r.json?.roundNumber} ${r.json?.status}`);
  const roundId = r.json._id;
  const roundNumber = r.json.roundNumber;

  // 9. History
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/game/history?limit=3', method: 'GET' });
  console.log(`9. History: ${r.status===200 && Array.isArray(r.json.items) ? 'PASS' : 'FAIL'} - ${r.json.items?.length} items`);

  // 10. Place bet invalid color
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'ORANGE', amount: 100 });
  console.log(`10. Bet invalid color: ${r.status===400 ? 'PASS' : 'FAIL'} - ${r.status}`);

  // 11. Bet amount too low
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'RED', amount: 5 });
  console.log(`11. Bet too low: ${r.status===400 ? 'PASS' : 'FAIL'}`);

  // 12. Bet insufficient balance
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'RED', amount: 999999 });
  console.log(`12. Bet insufficient: ${r.status===400 ? 'PASS' : 'FAIL'}`);

  // 13. Bet valid
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'RED', amount: 100 });
  console.log(`13. Bet valid RED 100: ${r.status===201 ? 'PASS' : 'FAIL'} - ${r.body.slice(0,120)}`);
  const betId = r.json?.bet?._id;

  // 14. Check balance deducted
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/balance', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`14. Balance deducted: ${r.json.balance===9900 ? 'PASS' : 'FAIL'} - ${r.json.balance}`);

  // 15. Get my bets
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bets`, method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`15. My bets: ${r.status===200 && r.json.bets.length===1 ? 'PASS' : 'FAIL'} - totals RED ${r.json.totals.RED}`);

  // 16. Admin stats with user token should 403
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/admin/stats', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`16. Admin stats user 403: ${r.status===403 ? 'PASS' : 'FAIL'}`);

  // 17. Admin login and stats
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'admin@colorarena.demo', password: 'Admin123!' });
  const adminToken = r.json.token;
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/admin/stats', method: 'GET', headers: { Authorization: `Bearer ${adminToken}` } });
  console.log(`17. Admin stats ok: ${r.status===200 && r.json.totalUsers>0 ? 'PASS' : 'FAIL'} - users ${r.json?.totalUsers}`);

  // 18. Admin adjust balance validation - too large
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/admin/users/${userId}/balance`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } }, { amount: 9999999, reason: 'test' });
  console.log(`18. Admin adjust too large: ${r.status===400 ? 'PASS' : 'FAIL'}`);

  // 19. Admin adjust balance valid
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/admin/users/${userId}/balance`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` } }, { amount: 500, reason: 'bonus' });
  console.log(`19. Admin adjust valid: ${r.status===200 ? 'PASS' : 'FAIL'} - new ${r.json?.after}`);
  // verify balance now 10400 (9900+500)
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/balance', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`   Balance after admin: ${r.json.balance===10400 ? 'PASS' : 'FAIL'} - ${r.json.balance}`);

  // 20. Socket test
  await new Promise((resolve, reject) => {
    let tickReceived = false;
    const socket = io('http://localhost:5000', { auth: { token } });
    const timeout = setTimeout(() => {
      socket.disconnect();
      console.log(`20. Socket tick: ${tickReceived ? 'PASS' : 'FAIL'} - ${tickReceived ? 'received' : 'timeout'}`);
      resolve();
    }, 5000);
    socket.on('round:tick', (data) => {
      tickReceived = true;
      console.log(`   tick #${data.roundNumber} ${data.remainingMs}ms`);
      clearTimeout(timeout);
      socket.disconnect();
      console.log(`20. Socket tick: PASS`);
      resolve();
    });
    socket.on('connect_error', (e) => {
      clearTimeout(timeout);
      console.log(`20. Socket connect_error: ${e.message}`);
      socket.disconnect();
      resolve();
    });
  });

  // 21. Test tie handling via direct DB? We verify last round 13 had tie
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/game/history?limit=1', method: 'GET' });
  // history is sorted by roundNumber desc, first is latest result
  // Find a round with tieBreakReason
  const allHistory = await req({ hostname: 'localhost', port: 5000, path: '/api/game/history?limit=100', method: 'GET' });
  const tieRound = allHistory.json.items.find(x => x.tieBreakReason && x.tieBreakReason.includes('TIE_BREAK'));
  console.log(`21. Tie handling: ${tieRound ? 'PASS' : 'FAIL'} - ${tieRound ? tieRound.tieBreakReason.slice(0,80) : 'no tie found'}`);

  // 22. Security: try to set winningColor via bet (should not be allowed)
  r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'GREEN', amount: 50, winningColor: 'RED' });
  // Should ignore winningColor and still place bet for GREEN
  console.log(`22. Ignore winningColor: ${r.status===201 && r.json.bet.color==='GREEN' ? 'PASS' : 'FAIL'}`);

  // 23. Rate limiting - quick burst (we should not hit 429 with 20 limit per 10s, but test)
  let ratePass = true;
  for (let i=0;i<5;i++) {
    r = await req({ hostname: 'localhost', port: 5000, path: `/api/game/${roundId}/bet`, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { color: 'BLUE', amount: 10 });
    if (r.status===429) ratePass=false;
  }
  console.log(`23. Rate limit not hit for 5: ${ratePass ? 'PASS' : 'FAIL'}`);

  // 24. Transaction log
  r = await req({ hostname: 'localhost', port: 5000, path: '/api/user/transactions?limit=5', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log(`24. Transactions: ${r.status===200 && r.json.items.length>=2 ? 'PASS' : 'FAIL'} - ${r.json.items?.length} txs`);

  // 25. Frontend reachable
  const front = await req({ hostname: 'localhost', port: 5173, path: '/', method: 'GET' });
  console.log(`25. Frontend: ${front.status===200 && front.body.includes('Color Arena') ? 'PASS' : 'FAIL'}`);

  console.log('=== RETEST DONE ===');
  process.exit(0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
