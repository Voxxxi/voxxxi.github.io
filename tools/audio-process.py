"""Local Demucs processing. No audio is sent to a third-party service."""
import argparse, pathlib, subprocess, json

def process(source, destination, ffmpeg, model_name='htdemucs'):
    import numpy as np
    import soundfile as sf
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    destination=pathlib.Path(destination);destination.mkdir(parents=True,exist_ok=True)
    decoded=destination/'decoded.wav'
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(source),'-t','901','-vn','-ac','2','-ar','44100',str(decoded)],check=True,timeout=180,capture_output=True)
    audio,sr=sf.read(decoded,dtype='float32',always_2d=True)
    if len(audio)>sr*900 or len(audio)<sr:raise ValueError('Нужна песня длительностью от 1 секунды до 15 минут.')
    device='cuda' if torch.cuda.is_available() else 'cpu'
    torch.set_num_threads(4)
    model=get_model(model_name).to(device).eval()
    wav=torch.from_numpy(audio.T.copy());ref=wav.mean(0);mean=ref.mean();std=ref.std().clamp(min=1e-8);normal=(wav-mean)/std
    with torch.inference_mode():
        separated=apply_model(model,normal[None],device=device,shifts=1,split=True,overlap=.25,progress=True)[0].cpu()
    # Match the upstream denormalisation before summing the accompaniment stems.
    separated=separated*std+mean
    vocal_index=model.sources.index('vocals')
    vocals=separated[vocal_index].numpy().T
    instrumental=separated[[i for i in range(len(model.sources)) if i!=vocal_index]].sum(0).numpy().T
    for name,data in [('instrumental',instrumental),('vocals',vocals)]:
        peak=float(np.abs(data).max());gain=min(1.,.98/max(peak,1e-8))
        sf.write(destination/(name+'.wav'),data*gain,sr,subtype='PCM_24')
    decoded.unlink(missing_ok=True)
    return {'device':device,'seconds':len(audio)/sr,'sample_rate':sr}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination');p.add_argument('--ffmpeg',required=True);args=p.parse_args()
    print(json.dumps(process(args.source,args.destination,args.ffmpeg)))
