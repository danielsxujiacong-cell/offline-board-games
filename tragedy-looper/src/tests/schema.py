"""Validate the actual split bundle with JSON Schema Draft 2020-12.
Run: python tragedy-looper/src/tests/schema.py (requires jsonschema).
"""
import json
from pathlib import Path
from jsonschema import Draft202012Validator
root=Path(__file__).resolve().parents[1]/'data'
read=lambda f: json.loads((root/f).read_text())
schema=read('schema.json')
Draft202012Validator.check_schema(schema)
bundle={'schemaVersion':1,**{key:read(file+'.json') for key,file in [('locations','locations'),('characters','characters'),('roles','roles'),('plots','plots'),('incidents','incidents'),('actionCards','action-cards')]},'scripts':[read('scripts/the-first-script.json'),read('scripts/prevailing-secrecy.json')]}
validator=Draft202012Validator(schema)
validator.validate(bundle)
for script in bundle['scripts']:
    assert len(script['characters'])==len(script['roles'])==6
    assert set(script['characters'])==set(script['roles'])==set(script['initialLayout'])
    assert script['mainPlot'] in {x['id'] for x in bundle['plots'] if x['kind']=='main'}
    assert script['subplot'] in {x['id'] for x in bundle['plots'] if x['kind']=='subplot'}
    for incident in script['incidents']:
        assert incident['day']<=script['daysPerLoop']
        assert incident['culprit'] in script['characters']
        assert incident['incident'] in {x['id'] for x in bundle['incidents']}
# Check the schema actually rejects wrong timing, missing English name and negative limits.
from copy import deepcopy
for mutate in [lambda b:b['characters'][0].pop('nameEn'),lambda b:b['characters'][0].update(paranoiaLimit=-1),lambda b:b['characters'][0]['goodwillAbilities'][0].update(timing='invented'),lambda b:b['scripts'][0].update(finalGuess=True),lambda b:b['locations'][0].update(intrigueOnly=False)]:
    invalid=deepcopy(bundle);mutate(invalid);assert not validator.is_valid(invalid)
print('PASS: Draft 2020-12 bundle + references + 5 invalid-data regressions')
