#!/usr/bin/env python3
"""Run actual KiCad 10 checks; missing tools/files are errors, never mocked PASS."""
from pathlib import Path
import datetime, json, shutil, subprocess, sys
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'reports/kicad'
def run(command):
    try:
        p = subprocess.run(command,text=True,capture_output=True,timeout=300,check=False)
        return {'command':command,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
    except (OSError,subprocess.TimeoutExpired) as exc:
        return {'command':command,'exit_code':None,'error':str(exc)}
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result = {'time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'NOT_RUN','runs':[]}
    cli = shutil.which('kicad-cli')
    if not cli:
        result['reason']='kicad-cli is not installed'
    else:
        version = run([cli,'version'])
        result['runs'].append(version)
        if version['exit_code'] != 0 or not version.get('stdout','').strip().startswith('10.'):
            result['reason']='KiCad 10 required; inspect actual installed version'
        else:
            missing=[]
            for board in ['FC','POWER']:
                folder=ROOT/'hardware'/board
                for ext in ['kicad_pro','kicad_sch','kicad_pcb']:
                    if not (folder/f'{board}_RevA.{ext}').is_file(): missing.append(str(folder/f'{board}_RevA.{ext}'))
            if missing:
                result['reason']='Native design files not yet available'
                result['missing']=missing
            else:
                for board in ['FC','POWER']:
                    sch=str(ROOT/'hardware'/board/f'{board}_RevA.kicad_sch')
                    pcb=str(ROOT/'hardware'/board/f'{board}_RevA.kicad_pcb')
                    commands=[
                        [cli,'sch','erc','--format','json','--exit-code-violations','-o',str(OUT/f'{board}_erc.json'),sch],
                        [cli,'pcb','drc','--format','json','--schematic-parity','--refill-zones','--save-board','--exit-code-violations','-o',str(OUT/f'{board}_drc.json'),pcb]]
                    result['runs'] += [run(c) for c in commands]
                result['status']='PASS' if all(v.get('exit_code')==0 for v in result['runs']) else 'FAIL'
    (OUT/'run_summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0 if result['status']=='PASS' else 2
if __name__=='__main__':
    sys.exit(main())
