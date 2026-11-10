#!/usr/bin/env python3
"""Rebuild machine-readable engineering inputs; does not create or validate CAD."""
from pathlib import Path
import csv
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def save_json(path, data):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def save_csv(path, fields, rows):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

def table_rows(text, heading):
    block = text.split(heading, 1)[1]
    output = []
    for line in block.splitlines()[1:]:
        if not line.startswith('|'):
            break
        row = [s.strip() for s in line.strip('|').split('|')]
        if all(re.fullmatch(r'[-: ]+', s) for s in row):
            continue
        output.append(row)
    return output

def main():
    fc = (ROOT / 'docs/FC_RevA_Design.md').read_text(encoding='utf-8')
    power = (ROOT / 'docs/POWER_RevA_Design.md').read_text(encoding='utf-8')
    pins = []
    for line in fc.splitlines():
        m = re.fullmatch(r'\| (\d+) \| (\d+) \| ([A-Z0-9_a-z]+) \| ([A-Z0-9_]+) \| ([A-Z_]+) \|', line)
        if m:
            gpio, pad, net, function, initial = m.groups()
            pins.append(dict(gpio=int(gpio), pad=int(pad), net=net, function=function, initial=initial))
    if len(pins) != 48 or {p['gpio'] for p in pins} != set(range(48)):
        raise ValueError('Expected exactly 48 GPIO entries from the FC specification')
    save_json('data/fc_pinmap.json', {'revision':'A.1','pins':pins})
    save_csv('data/fc_pinmap.csv', list(pins[0]), pins)
    header = ['/* Generated from Rev A design inputs; not a tested board BSP. */', '#pragma once']
    header += [f"#define MANGO_PIN_{p['net']} {p['gpio']}" for p in pins]
    (ROOT / 'data/board_pins.h').write_text('\n'.join(header)+'\n', encoding='utf-8')
    connections = {
        'J1': ['+5V_PWR','+5V_PWR','GND','GND'],
        'J2': ['GND','MOTOR1_CMD','MOTOR2_CMD','MOTOR3_CMD','MOTOR4_CMD','GND','MOTOR_ARM_REQ','MOTOR_HEARTBEAT','USB_KILLn','MOTOR_FAULTn','PWR_PGOOD','POWER_IDn'],
        'J3': ['GND','VBAT_MON_RAW','I1_RAW','I2_RAW','GND','I3_RAW','I4_RAW','GND']}
    interfaces = {board:{name:[{'pin':i+1,'net':net} for i,net in enumerate(nets)] for name,nets in connections.items()} for board in ('FC','POWER')}
    save_json('data/board_interfaces.json', {'revision':'A.1','wiring':'1-to-1 by contact number; no hot plug','max_cable_mm':80,'boards':interfaces})
    holes = [[9.75,9.75],[40.25,9.75],[9.75,40.25],[40.25,40.25]]
    save_json('data/mechanical.json', {'units':'mm','coordinate_system':'top view lower-left origin, +Y forward','status':'ENGINEERING_DEFAULT_NOT_FRAME_FIT_CONFIRMED','FC':{'width':50,'height':60,'thickness':1.0,'layers':4,'outer_copper_oz':1,'inner_copper_oz':1},'POWER':{'width':50,'height':45,'thickness':1.2,'layers':4,'outer_copper_oz':2,'inner_copper_oz':1},'mount_holes':holes,'mount_hole_diameter':3.2,'standoff_height':12,'RF_keepout':{'rectangle':[7.25,51.5,42.75,70],'status':'CONFIRM_AGAINST_RM2_FIG6_DURING_LAYOUT','all_copper_layers':True,'also_exclude_battery_wiring_metal':True}})
    fc_bom = table_rows(fc, '| 主要元件 | 數量 | 作用 |')
    power_bom = table_rows(power, '| 料號 | 數量 | 用途 |')
    power_bom += [['SN74LVC1G07DBVR','1','PGOOD isolation, addendum A1'],['SMBJ10A','1','TVS: choose exact manufacturer suffix in manufacturing BOM'],['EEH-ZC1E221P','1','220uF 25V bulk; check height and assembly'],]
    fc_bom += [['USB4105-GF-A','1','USB-C data-only input'],]
    for rows, counts in [(fc_bom,[4,12,8,4,8,6,3,2]), (power_bom,[4,12,8])]:
        grouped = {}
        for n in counts:
            grouped[n] = grouped.get(n,0)+1
        rows += [[f'SM{n:02d}B-GHS-TB(LF)(SN)',str(count),'JST GH board connector, count by actual ports'] for n,count in grouped.items()]
    for board,rows in [('fc',fc_bom),('power',power_bom)]:
        save_csv(f'data/bom_{board}.csv',['mpn','quantity','purpose','status'],[dict(mpn=a,quantity=int(b),purpose=c,status='ENGINEERING_SELECTION_NOT_FULL_ASSEMBLY_BOM') for a,b,c in rows])
    save_json('data/design_targets.json', {'status':'ENGINEERING_TARGETS_NOT_MEASURED','battery_operating_v':[6.4,8.4],'per_channel_thermal_target_a':3.0,'hardware_trip_nominal_a':12.0,'shunt_ohm':0.01,'sense_gain':20,'raw_v_per_a':0.2,'adc_v_per_a':0.2*20/30,'watchdog_cwd_pf':100,'watchdog_nominal_ms':77.4*0.1+55,'watchdog_stop_target_ms':75,'hardware_trip_delay_target_us':100,'pwm_initial_hz':25000,'v5_nominal':0.791*(1+107/20),'vbat_adc_at_8v4':8.4*33/133,'diode_loss_example_w':0.39*1.5+0.028*(3**2*0.5),'shunt_loss_example_w':3**2*.01,'manufacturing_order_authorized':False})
    tests = []
    for board,text in [('FC',fc),('POWER',power)]:
        for line in text.splitlines():
            if re.match(r'^\| (FC-\d+|P-\d+)',line):
                row = [s.strip() for s in line.strip('|').split('|')]
                tests.append(dict(board=board,test_id=row[0],method=row[1],acceptance=row[2],status='NOT_TESTED',measurement='',operator='',date=''))
    save_csv('data/prototype_test_plan.csv',list(tests[0]),tests)
    source_text = (ROOT/'docs/SOURCES.md').read_text(encoding='utf-8')
    sources = []
    for entry in re.split(r'^## ',source_text,flags=re.M)[1:]:
        lines = [v.strip() for v in entry.splitlines() if v.strip()]
        sid,title = lines[0].split('｜',1)
        sources.append(dict(id=sid,title=title,url=lines[1],scope=' '.join(lines[2:])))
    save_json('data/sources.json',sources)
    print(f'Generated {len(pins)} GPIOs, 3 matched interfaces, {len(tests)} untested procedures, and {len(sources)} sources; no CAD PASS claimed.')

if __name__ == '__main__':
    main()
