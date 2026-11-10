#!/usr/bin/env python3
"""Checks engineering input consistency, NOT ERC, DRC, SI, PI or thermal safety."""
from pathlib import Path
import json, math, sys
ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT/path).read_text(encoding='utf-8'))
def main():
    errors = []
    def require(condition,message):
        if not condition: errors.append(message)
    pins = load('data/fc_pinmap.json')['pins']
    require(len(pins)==48,'GPIO count')
    require(len({p['gpio'] for p in pins})==48,'duplicate GPIO')
    require(len({p['pad'] for p in pins})==48,'duplicate GPIO pad')
    by_gpio = {p['gpio']:p for p in pins}
    for g,f in [(0,'QMI_CS1'),(32,'PWM8_A'),(33,'PWM8_B'),(34,'PWM9_A'),(35,'PWM9_B'),(40,'ADC0'),(44,'ADC4'),(47,'ADC7')]:
        require(by_gpio[g]['function']==f,f'GPIO{g} function')
    iface = load('data/board_interfaces.json')['boards']
    require(iface['FC']==iface['POWER'],'cross-board pin mismatch')
    require(iface['FC']['J3'][1]['net']=='VBAT_MON_RAW','raw battery input must be explicitly named')
    t = load('data/design_targets.json')
    require(math.isclose(t['hardware_trip_nominal_a'],2.4/(.01*20)),'trip calculation')
    require(math.isclose(t['v5_nominal'],5.02285),'5V calculation')
    require(math.isclose(t['watchdog_nominal_ms'],62.74),'watchdog calculation')
    for path in ['AGENTS.md','START_HERE_CODEX.md','docs/FC_RevA_Design.md','docs/POWER_RevA_Design.md','docs/IMPLEMENTATION_ADDENDUM.md','docs/SOURCES.md']:
        require((ROOT/path).is_file(),f'missing {path}')
    result = {'scope':'INPUT_CONSISTENCY_ONLY','status':'FAIL' if errors else 'PASS','errors':errors,'erc':'NOT_RUN','drc':'NOT_RUN','physical_tests':'NOT_TESTED'}
    (ROOT/'reports').mkdir(exist_ok=True)
    (ROOT/'reports/input_consistency.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
    return 1 if errors else 0
if __name__=='__main__':
    sys.exit(main())
