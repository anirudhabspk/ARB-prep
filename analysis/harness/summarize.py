"""Summarize the selected checkpoint at 12h; do not pool different tasks' scores."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def summarize(data):
    comparisons=[]; agreements=[]; native={k:dict(wins=0,losses=0,ties=0,missing=0) for k in ('codex_sol','claude_opus')}
    for t in data['tasks']:
        s={k:v['test'][-1] for k,v in t['series'].items()}
        comparisons.append(dict(task=t['name'],scores=s))
        for n,b in [('codex_sol','standard_sol'),('claude_opus','standard_opus')]:
            if s[n] is None or s[b] is None:native[n]['missing']+=1
            else:native[n]['wins' if s[n]>s[b] else 'losses' if s[n]<s[b] else 'ties']+=1
        if all(v is not None for v in s.values()):
            sign=lambda x:(x>0)-(x<0)
            agreements.append(dict(task=t['name'],same_order=sign(s['standard_opus']-s['standard_sol'])==sign(s['claude_opus']-s['codex_sol'])))
    return dict(comparisons=comparisons,native_vs_terminus=native,model_order=agreements)

if __name__=='__main__':
    data=json.loads((ROOT/'harness-ablation-data.js').read_text().split('=',1)[1].rstrip(';\n'))
    out=summarize(data)
    (ROOT/'analysis/harness/findings.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps({k:v for k,v in out.items() if k!='comparisons'},indent=2))
