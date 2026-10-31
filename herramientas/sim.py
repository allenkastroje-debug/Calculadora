# Simulador: envía paquetes UDP de 324 bytes con el formato del juego, para probar sin el juego.
import importlib.util,socket,struct,sys,time,math
s=importlib.util.spec_from_file_location('r','receptor-telemetria.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def pk(on,ts,spd,rpm,ax,nt,sr,sa,cs,tmp,gas,brk,gear,steer,dt=1,lap=1):
    v=[on,ts, 7000.,900.,rpm, ax,0.,0., 0.,0.,spd, 0.,0.,0., 0.,0.,0.]
    v+=nt+sr+[0.]*4+[0]*4+[0]*4+[0.]*4+sa+cs+[0.]*4
    v+=[1234,3,600,dt,4, 0, 0.,0., 0.,0.,0., spd,150000.,300., ]+tmp+[0.,1.,100., 80.,81.,70.,70.]
    v+=[lap,1, gas,brk,0,0,gear, steer,0,0]
    return struct.pack(m.FMT,*v)+b"\0"
def run(scn,secs=40,port=9999):
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);ts=0
    t0=time.time();n=0
    while time.time()-t0<secs:
        ph=(n%600)/600.0  # vuelta de ~10 s a 60 Hz
        # 0-.25 recta, .25-.4 frenada+entrada, .4-.55 curva media, .55-.7 salida, resto recta
        if ph<.25: seg='r'
        elif ph<.4: seg='e'
        elif ph<.55: seg='m'
        elif ph<.7: seg='x'
        else: seg='r'
        gas={'r':250,'e':0,'m':120,'x':230}[seg]; brk={'r':0,'e':200,'m':0,'x':0}[seg]
        steer={'r':0,'e':60,'m':90,'x':50}[seg]
        ax=0. if seg=='r' else 7.5
        f,rr=0.2,0.2   # slip angle frente/atrás por defecto
        nt=[.45,.45,.45,.45]; sr=[0.,0.,0.,0.]
        if seg!='r':
            if scn=='sub': f,rr=.75,.30
            elif scn=='sob': f,rr=.30,.75
            else: f,rr=.45,.40
        if scn=='bot' and seg!='r': nt=[.99,.99,.5,.5]
        if scn=='trac' and seg=='x': sr=[0.1,0.1,1.4,1.5]
        if scn=='lock' and seg=='e': sr=[-1.3,-1.2,-.2,-.2]
        sa=[f,f,rr,rr]
        d=pk(1,ts,45.,5500.,ax,nt,sr,sa,[a*1.0 for a in sa],[190.,190.,180.,180.],gas,brk,4,steer)
        sock.sendto(d,('127.0.0.1',port));ts+=16;n+=1;time.sleep(1/60)
if __name__=='__main__': run(sys.argv[1] if len(sys.argv)>1 else 'bal',float(sys.argv[2]) if len(sys.argv)>2 else 40)
