import subprocess, json, os

payload = {
    "httpMethod": "GET",
    "pathParameters": {"id": "2b7599a3-test"},
    "headers": {"Authorization": "Bearer test"},
    "requestContext": {
        "authorizer": {
            "claims": {
                "sub": "uid-123",
                "custom:role": "LabAssistant",
                "email": "staff@lab.edu",
                "name": "Lab Staff"
            }
        }
    }
}

with open('test_payload.json', 'w') as f:
    json.dump(payload, f)

r = subprocess.run([
    'aws', 'lambda', 'invoke',
    '--function-name', 'smart-lab-booking-get-by-id',
    '--payload', 'file://test_payload.json',
    '--cli-binary-format', 'raw-in-base64-out',
    'test_response.json'
], capture_output=True, text=True)
print('Invoke stderr:', r.stderr[:300])

out = json.load(open('test_response.json'))
print(json.dumps(out, indent=2)[:800])
os.remove('test_payload.json')
os.remove('test_response.json')
