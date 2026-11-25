# Simulador: envía paquetes UDP de 324 bytes con el formato del juego, para probar sin el juego.
import importlib.util,socket,struct,sys,time,math
s=importlib.util.spec_from_file_location('r','receptor-telemetria.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def pk(on,ts,spd,rpm,ax,nt,sr,sa,cs,tmp,gas,brk,gear,steer,dt=1,lap=1,last=80.,cur=0.,az=0.,pos=(0.,0.,0.),pw=150000.,rpmmax=7000.,rp=1):
    v=[on,ts, rpmmax,900.,rpm, ax,0.,az, 0.,0.,spd, 0.,0.,0., 0.,0.,0.]
    v+=nt+sr+[0.]*4+[0]*4+[0]*4+[0.]*4+sa+cs+[0.]*4
    v+=[1234,3,600,dt,4, 0, 0.,0., pos[0],pos[1],pos[2], spd,pw,300., ]+tmp+[0.,1.,100., 80.,last,cur,cur]
    v+=[lap,rp, gas,brk,0,0,gear, steer,0,0]
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
        th=2*math.pi*(n%600)/600.0
        d=pk(1,ts,45.,5500.,ax,nt,sr,sa,[a*1.0 for a in sa],[190.,190.,180.,180.],gas,brk,4,steer,az=({'x':4.0}.get(seg,0.) if scn=='bal' else {'x':2.5}.get(seg,0.)),pos=(1000+200*math.cos(th),50.,1000+120*math.sin(th)),lap=1+n//600,last=({'sub':10.6,'sob':10.4,'bot':10.3,'trac':10.5,'lock':10.2}.get(scn,10.0) if n>=600 else 0.),cur=(n%600)/60.)
        sock.sendto(d,('127.0.0.1',port));ts+=16;n+=1;time.sleep(1/60)
def launch(port=9999,reps=3,t100=4.6):
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);ts=0
    for r in range(reps):
        for k in range(120):   # parado 2 s
            sock.sendto(pk(1,ts,0.,900.,0.,[.5]*4,[0.]*4,[.1]*4,[.1]*4,[90.]*4,0,0,1,0),('127.0.0.1',port));ts+=16;time.sleep(1/60)
        n=int(t100*60)
        for k in range(n):     # acelera 0-100 km/h
            sp=27.78*k/n
            sock.sendto(pk(1,ts,sp,5000.,0.,[.5]*4,[0.]*4,[.1]*4,[.1]*4,[90.]*4,255,0,2,0),('127.0.0.1',port));ts+=16;time.sleep(1/60)
        for k in range(60):
            sock.sendto(pk(1,ts,28.+k/10.,5000.,0.,[.5]*4,[0.]*4,[.1]*4,[.1]*4,[90.]*4,255,0,3,0),('127.0.0.1',port));ts+=16;time.sleep(1/60)
def hudrun(secs=40,port=9999):
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);ts=0;t0=time.time();n=0
    while time.time()-t0<secs:
        t=n/60.0;g=1+int(t/3)%5;ph=(t%3)/3.0
        rpm=2500+ph*4700;spd=g*9+ph*7
        pw=150000*math.sin(min(1,(rpm-1500)/5200)*3.14)+10000
        d=pk(1,ts,spd,rpm,0.,[.5]*4,[0.]*4,[.2+ph*.9]*4,[.2+ph*.9]*4,[90.]*4,255,0,g,int(40*math.sin(t)),lap=1+int(t/12),last=108.823,cur=t%12*9.1,pw=pw,rp=3)
        sock.sendto(d,('127.0.0.1',port));ts+=16;n+=1;time.sleep(1/60)
if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='hud': hudrun(float(sys.argv[2]) if len(sys.argv)>2 else 40)
elif __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='launch': launch(t100=float(sys.argv[2]) if len(sys.argv)>2 else 4.6)
elif __name__=='__main__': run(sys.argv[1] if len(sys.argv)>1 else 'bal',float(sys.argv[2]) if len(sys.argv)>2 else 40)
