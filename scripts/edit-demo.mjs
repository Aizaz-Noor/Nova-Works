// Edits actual captured pixels; no fabricated UI states, audio, music or provider output.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
const capture=JSON.parse(await readFile(process.argv[2],'utf8'));
const shots=process.argv[3] ? JSON.parse(await readFile(process.argv[3],'utf8')) : null;
const scratch=resolve('tmp/demo-edit');await mkdir(scratch,{recursive:true});
const duration=Number(capture.duration)+6;
const scenes=capture.scenes.map(s=>({...s,time:s.time+2}));
function srtTime(n){const ms=Math.round(n*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
let srt='';for(let i=0;i<scenes.length;i++){const s=scenes[i],end=scenes[i+1]?.time??duration;await writeFile(resolve(scratch,`caption-${i}.txt`),s.text);srt+=`${i+1}\n${srtTime(s.time)} --> ${srtTime(end)}\n${s.text}\n\n`;}
await writeFile('docs/assets/novaworks-demo.srt',srt);
const font="fontfile='C\\:/Windows/Fonts/arial.ttf'";
const text=(file,x,y,size,start,end,color='white')=>`drawtext=${font}:textfile='${relative(process.cwd(),file).replaceAll('\\','/')}':fontcolor=${color}:fontsize=${size}:x=${x}:y=${y}${start!==undefined?`:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`:''}`;
await writeFile(resolve(scratch,'title.txt'),'NovaWorks  |  Meeting to Execution');
await writeFile(resolve(scratch,'context.txt'),'Post-event portfolio demo  |  Actual recorded app  |  Fictional data');
await writeFile(resolve(scratch,'link.txt'),'nova-works-zeta.vercel.app  |  github.com/Aizaz-Noor/Nova-Works');
const base='fps=25,tpad=start_mode=clone:start_duration=2:stop_mode=clone:stop_duration=4';
const main=[base,'scale=1600:900','pad=1920:1080:160:90:color=0x132f29',text(resolve(scratch,'title.txt'),160,24,38),text(resolve(scratch,'context.txt'),1060,36,20)];
for(let i=0;i<scenes.length;i++)main.push(text(resolve(scratch,`caption-${i}.txt`),'(w-text_w)/2',1020,33,scenes[i].time,scenes[i+1]?.time??duration));
const vertical=[base,'scale=1080:608','pad=1080:1920:0:530:color=0x132f29',text(resolve(scratch,'title.txt'),60,220,45),text(resolve(scratch,'context.txt'),60,290,23)];
for(let i=0;i<scenes.length;i++){const words=scenes[i].text.split(' ');let lines=[''];for(const word of words){const last=lines.length-1;if((lines[last]+word).length>34)lines.push(word+' ');else lines[last]+=word+' ';}await writeFile(resolve(scratch,`vertical-${i}.txt`),lines.map(s=>s.trim()).join('\n'));vertical.push(text(resolve(scratch,`vertical-${i}.txt`),60,1490,48,scenes[i].time,scenes[i+1]?.time??duration));}
await writeFile(resolve(scratch,'vertical-link.txt'),'Try the demo\nCode and story in the description');
vertical.push(text(resolve(scratch,'vertical-link.txt'),60,1780,34));
const taskAt=capture.scenes.find(s=>s.text.startsWith('Every task')).time;
const directoryAt=capture.scenes.find(s=>s.text.startsWith('A searchable')).time;
const mobileAt=capture.scenes.find(s=>s.text.startsWith('Responsive')).time;
const endMobile=capture.scenes.find(s=>s.text.startsWith('Try the live')).time;
const assembly=shots?`[0:v]split=3[a][c][e];[1:v]split=2[b][d];[a]trim=end=${taskAt},setpts=PTS-STARTPTS[s0];[b]trim=start=${shots.detailStart}:end=${shots.detailStart+directoryAt-taskAt},setpts=PTS-STARTPTS[s1];[c]trim=start=${directoryAt}:end=${mobileAt},setpts=PTS-STARTPTS[s2];[d]trim=start=${shots.mobileStart}:end=${shots.mobileStart+endMobile-mobileAt},setpts=PTS-STARTPTS,crop=375:720:0:0,pad=1280:720:452:0:color=0x132f29[s3];[e]trim=start=${endMobile},setpts=PTS-STARTPTS[s4];[s0][s1][s2][s3][s4]concat=n=5:v=1:a=0[assembled];`:'[0:v]null[assembled];';
for(const [name,filters] of [['novaworks-demo.mp4',main],['novaworks-demo-vertical.mp4',vertical]]){const output=resolve('docs/assets',name);console.log(`Encoding ${name}`);const r=spawnSync('ffmpeg',['-y','-i',capture.raw,...(shots?['-i',shots.raw]:[]),'-filter_complex',(name.includes('vertical') && shots ? assembly+'[assembled]split=2[all][phone];[all]'+filters.slice(0,3).join(',')+'[back];[phone]'+base+',crop=375:720:452:0,scale=520:998,pad=1080:1920:280:420:color=0x132f29[phoneframe];[back][phoneframe]overlay=0:0:enable='+"'between(t,"+(mobileAt+2)+','+(endMobile+2)+")'"+'[picture];[picture]'+filters.slice(3).join(',')+'[out]' : assembly+'[assembled]'+filters.join(',')+'[out]'),'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['ignore','ignore','pipe'],encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);console.log(`Encoded ${name}`);}
const provenance={recordedDate:capture.recordedDate,actualAI:capture.actualAI,fictionalData:true,recordingOrigin:'isolated local app, same product source',counts:capture.counts,providerWaitSeconds:capture.processing.end-capture.processing.start,editing:'Actual browser recordings with task and mobile detail shots from the same saved batch; 2-second opening and 4-second ending holds; captions and framing. Original AI processing wait preserved without cuts.',audio:'Silent; captioned. Optional voiceover script provided separately.',durationTarget:duration,formats:['1920x1080 H.264 MP4','1080x1920 H.264 MP4'],browserErrors:capture.browserErrors};
await writeFile('docs/assets/PROVENANCE.json',JSON.stringify(provenance,null,2));