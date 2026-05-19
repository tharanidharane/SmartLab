import json, urllib.request, urllib.error

API = 'https://3o8rrugo16.execute-api.us-east-1.amazonaws.com/Prod'
raw = open('token.json', encoding='utf-16').read().strip()
tok = json.loads(raw)
refresh = tok['refreshToken']

# Refresh token
req = urllib.request.Request(
    f'{API}/auth/refresh',
    data=json.dumps({'refreshToken': refresh}).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    resp = urllib.request.urlopen(req)
    new_tokens = json.loads(resp.read())
    id_token = new_tokens.get('idToken') or new_tokens.get('accessToken')
    print('Fresh token OK, length:', len(id_token))

    # Get equipment
    eq_req = urllib.request.Request(
        f'{API}/equipment',
        headers={'Authorization': 'Bearer ' + id_token}
    )
    items = json.loads(urllib.request.urlopen(eq_req).read()).get('items', [])
    print('Equipment count:', len(items))

    if not items:
        print('No equipment found - cannot test booking')
        exit(1)

    eid = items[0]['equipmentId']
    ename = items[0]['name']
    print('Booking equipment:', ename, '(' + eid + ')')

    # Create booking
    body = json.dumps({
        'equipmentId': eid,
        'slot': {'date': '2026-03-10', 'startTime': '09:00', 'endTime': '10:00', 'timezone': 'Asia/Kolkata'},
        'purpose': 'Testing booking creation after IAM policy fix',
    }).encode()
    book_req = urllib.request.Request(
        f'{API}/bookings', data=body,
        headers={'Authorization': 'Bearer ' + id_token, 'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        result = json.loads(urllib.request.urlopen(book_req).read())
        b = result.get('booking', result)
        print('BOOKING SUCCESS!')
        print('  status:', b.get('status'))
        print('  bookingId:', b.get('bookingId', '')[:12] + '...')
        print('  equipment:', b.get('equipmentName'))
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print('BOOKING ERROR', e.code, ':', err)

except urllib.error.HTTPError as e:
    print('Refresh error', e.code, ':', e.read().decode())
