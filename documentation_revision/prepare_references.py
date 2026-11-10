import json,re,html
from pathlib import Path
p=json.loads(Path('documentation_revision/paragraphs.json').read_text(encoding='utf-8'))
fix={
1450:'Gambini, E., Ceppi, A., Ravazzani, G., Mancini, M., Valsecchi, I. Q., Cucchi, A., Negretti, A., & Tolone, I. (2024). An empirical rainfall threshold approach for the civil protection flood warning system on the Milan urban area. Journal of Hydrology, 628, 130513. https://doi.org/10.1016/j.jhydrol.2023.130513',
1458:'Liu, C.-C., Hsu, K., Peng, M. S., Chen, D.-S., Chang, P.-L., Hsiao, L.-F., Fong, C.-T., Hong, J.-S., Cheng, C.-P., Lu, K.-C., Chen, C.-R., & Kuo, H.-C. (2024). Evaluation of five global AI models for predicting weather in Eastern Asia and Western Pacific. npj Climate and Atmospheric Science, 7, Article 221. https://doi.org/10.1038/s41612-024-00769-0',
1470:'Philippine Statistics Authority. (2025, July 17). 2024 Census of Population (POPCEN) population counts declared official by the President. https://psa.gov.ph/content/2024-census-population-popcen-population-counts-declared-official-president',
1471:'Piamonte, C. N., Curada, J. P. M., & Zaragoza, M. C. (2026). Project Bantay: Breadth-first search and Dijkstra implementation for community-accessible disaster response. In J. Caro et al. (Eds.), Proceedings of the Workshop on Computation: Theory and Practice (WCTP 2025) (Atlantis Highlights in Computer Sciences, Vol. 24, pp. 629–645). https://doi.org/10.2991/978-94-6239-638-8_33',
1475:'Tsai, Y.-L., Irvin, J., Chundi, S., Ng, A. Y., Field, C. B., & Kitanidis, P. K. (2022). Improving debris flow evacuation alerts in Taiwan using machine learning [Preprint]. arXiv. https://doi.org/10.48550/arXiv.2208.13027'
}
oldfix={1470:fix[1470],1471:'Piamonte, C. N., Curada, J. P. M., & Zaragoza, M. C. (2026). Project Bantay: Breadth-first search and Dijkstra implementation for community-accessible disaster response. In Proceedings of WCTP 2025 (Atlantis Highlights in Computer Sciences, Vol. 24, pp. 629–645). https://doi.org/10.2991/978-94-6239-638-8_33'}
journals=['Vaccines','Journal of Flood Risk Management','Applied Sciences','Earth and Space Science','Ani: Letran Calamba Research Report','Frontiers in Applied Mathematics and Statistics','Stochastic Environmental Research and Risk Assessment','Research, Society and Development','JPAIR Multidisciplinary Research Journal','International Journal of Disaster Risk Reduction','Journal of Hydrology','Psychology and Education: A Multidisciplinary Journal','ISU Linker: Journal of Engineering, Computing and Technology','Quarterly Journal of the Royal Meteorological Society','npj Climate and Atmospheric Science','Natural Hazards','Geoscientific Model Development','Water','Indian Journal of Computer Science and Technology','Computational Intelligence and Neuroscience','Sustainability']
def formatted(t):
    s=html.escape(t)
    m=re.search(r'\([^)]*\)\. ',t)
    if not m:return s
    tail=t[m.end():]
    journal=next((j for j in journals if tail.find(j)>=0),None)
    if journal:
        start=t.index(journal,m.end());end=start+len(journal)
        vm=re.match(r', \d+',t[end:])
        if vm:end+=len(vm.group())
        s=html.escape(t[:start])+'<i>'+html.escape(t[start:end])+'</i>'+html.escape(t[end:])
    else:
        # Standalone reports, software, web pages and preprints have italic titles.
        end=tail.find('. https://')
        if end<0:end=tail.find('. Retrieved ')
        if end<0:end=tail.find('. ')
        if end<0:end=len(tail)
        start=m.end();end+=start
        s=html.escape(t[:start])+'<i>'+html.escape(t[start:end])+'</i>'+html.escape(t[end:])
    return s
def para(t):return '<p style="font-family:Times New Roman;font-size:12pt;font-weight:normal;font-style:normal;line-height:2;margin-left:36pt;text-indent:-36pt;margin-top:0;margin-bottom:0"><span style="font-weight:normal;font-style:normal">'+formatted(t)+'</span></p>'
add={
1464:['Open-Meteo. (n.d.). Weather forecast API. Retrieved November 6, 2026, from https://open-meteo.com/en/docs'],
1466:['OpenWeather. (n.d.). One Call API 3.0. Retrieved November 6, 2026, from https://openweathermap.org/api/one-call-3'],
1468:['Philippine Institute of Volcanology and Seismology. (n.d.). HazardHunterPH. Retrieved November 6, 2026, from https://hazardhunter.georisk.gov.ph/'],
1477:['WeatherAPI.com. (n.d.). Weather API documentation. Retrieved November 6, 2026, from https://www.weatherapi.com/docs/']
}
rows=[]
for i in range(1436,1484):
    old=oldfix.get(i,p[i]).strip();new=fix.get(i,p[i]).strip()
    new=new.replace('19(Version 1)','19(1)').replace('61(Version 3)','61(3)').replace('37(Version 5)','37(5)')
    new=new.replace('In J. Caro et al. (Eds.), Proceedings','In Proceedings')
    # Disambiguate Open-Meteo n.d. sources by descriptive titles and letters.
    if i==1464:
        new=new.replace('(n.d.)','(n.d.-a)')
        extras=[x.replace('(n.d.)','(n.d.-b)') for x in add.get(i,[])]
    else: extras=add.get(i,[])
    rows.append({'find':old,'html':para(new)+''.join(para(x) for x in extras),'new':new,'index':i})
Path('documentation_revision/reference_edits.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(len(rows),'reference paragraphs')
