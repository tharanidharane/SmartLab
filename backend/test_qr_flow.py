import json, urllib.request, urllib.error

API = 'https://3o8rrugo16.execute-api.us-east-1.amazonaws.com/Prod'
raw = open('token.json', encoding='utf-16').read().strip()
tok = json.loads(raw)

# Refresh token
req = urllib.request.Request(f'{API}/auth/refresh', data=json.dumps({'refreshToken': tok['refreshToken']}).encode(), headers={'Content-Type':'application/json'}, method='POST')
new_tok = json.loads(urllib.request.urlopen(req).read())
id_token = new_tok.get('idToken') or new_tok.get('accessToken')
print('Token refreshed OK')

# Get existing booking
req2 = urllib.request.Request(f'{API}/bookings', headers={'Authorization':'Bearer '+id_token})
bookings = json.loads(urllib.request.urlopen(req2).read()).get('bookings', [])
active = [b for b in bookings if b.get('status') in ('PENDING','APPROVED')]
if not active:
    print('No active bookings to test with')
    exit(1)

booking = active[0]
bid = booking['bookingId']
print(f'Testing with booking: {bid[:8]}... status={booking["status"]} equip={booking["equipmentName"]}')

# Test 1: GET /bookings/{id}  (what the scanner calls)
print('\n--- Test 1: GET /bookings/{id} ---')
try:
    req3 = urllib.request.Request(f'{API}/bookings/{bid}', headers={'Authorization':'Bearer '+id_token})
    result = json.loads(urllib.request.urlopen(req3).read())
    b = result.get('booking', result)
    print('SUCCESS - bookingId:', b.get('bookingId','')[:8]+'...')
    print('         status:', b.get('status'))
    print('         equipment:', b.get('equipmentName'))
    print('         userEmail:', b.get('userEmail'))
except urllib.error.HTTPError as e:
    print('FAILED', e.code, json.loads(e.read()))

# Test 2: PUT /bookings/{id}/status with COMPLETED
print('\n--- Test 2: PUT /bookings/{id}/status COMPLETED ---')
try:
    body = json.dumps({'status': 'COMPLETED'}).encode()
    req4 = urllib.request.Request(f'{API}/bookings/{bid}/status', data=body, headers={'Authorization':'Bearer '+id_token, 'Content-Type':'application/json'}, method='PUT')
    result = json.loads(urllib.request.urlopen(req4).read())
    print('SUCCESS:', result)
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print('FAILED', e.code, err)
