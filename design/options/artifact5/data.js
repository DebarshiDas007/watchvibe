/* Real titles from the WatchVibe catalogue (TMDB images). Shared by the five design options. */
window.WV = (() => {
  const raw = [
    ["Interstellar",2014,8.5,"/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg","/8sNiAPPYU14PUepFNeSNGUTiHW.jpg","Adventure · Drama","A team of explorers uses a newly found wormhole to cross the limits of human space travel.","mind"],
    ["Inception",2010,8.4,"/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg","/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg","Action · Sci-Fi","A skilled thief who steals secrets from dreams is offered a chance to get his old life back.","mind"],
    ["Parasite",2019,8.5,"/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg","/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg","Comedy · Thriller","An unemployed family takes an interest in a wealthy household, until things get tangled.","mind"],
    ["The Dark Knight",2008,8.5,"/qJ2tW6WMUDux911r6m7haRef0WH.jpg","/cfT29Im5VDvjE0RpyKOSdCKZal7.jpg","Action · Thriller","Batman raises the stakes in his war on crime and meets a new kind of enemy.","hype"],
    ["Spider-Man: Brand New Day",2026,8.5,"/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg","/4tjxYg2AbOzzG9G1YuiT2NzYhlH.jpg","Sci-Fi · Action","Fighting crime full-time in a world that no longer remembers him.","hype"],
    ["Project Hail Mary",2026,8.6,"/iOb2fjXLbpJgyQXe46n1WtGCnaa.jpg","/8Tfys3mDZVp4tNoH2ktm06a0Tau.jpg","Sci-Fi · Adventure","A science teacher wakes up on a spaceship light years from home with no memory of how he got there.","mind"],
    ["Dune: Part Two",2024,8.1,"/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg","/eZ239CUp1d6OryZEBPnO2n87gMG.jpg","Sci-Fi · Adventure","Paul Atreides unites with the Fremen on a path of revenge against those who destroyed his family.","hype"],
    ["3 Idiots",2009,8.0,"/66A9MqXOyVFCssoloscw79z8Tew.jpg","/u7kuUaySqXBVAtqEl9vkTkAzHV9.jpg","Drama · Comedy","Three friends at India's top engineering college chase what they love, not what they are told to.","laugh"],
    ["Dangal",2016,7.9,"/cJRPOLEexI7qp2DKtFfCh7YaaUG.jpg","/l0fNAHLOFReQJsxCOmGWvJDnimn.jpg","Drama · Family","The true story of Mahavir Singh Phogat and his two daughters, who became wrestling champions.","cry"],
    ["Dilwale Dulhania Le Jayenge",1995,8.5,"/lfRkUr7DYdHldAqi3PwdQGBRBPM.jpg","/7VDLEHli74eLsYLNcq9djn1Gw76.jpg","Comedy · Drama","Raj and Simran meet on a trip across Europe and fall in love, with a strict father in the way.","comfort"],
    ["Michael",2026,8.6,"/dueFqKLvjftnELZaGYwY7xinfaI.jpg","/ufSwlnECLoUbBjPrFqEQcWBzHwc.jpg","Music · Drama","The story of Michael Jackson, and his life beyond the music.","cry"],
    ["The Wild Robot",2024,8.3,"/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg","/1pmXyN3sKeYoUhu5VBZiDU4BX21.jpg","Family · Animation","A robot stranded on an island learns to survive by bonding with the animals.","comfort"],
    ["Coco",2017,8.2,"/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg","/g7CHF8gTLGooTbP4GznIGwaqAGL.jpg","Family · Animation","Miguel dreams of being a musician, in a family that banned music generations ago.","cry"],
    ["Spirited Away",2001,8.5,"/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg","/m4TUa2ciEWSlk37rOsjiSIvZDXE.jpg","Animation · Family","A girl trapped in a world of spirits must save her parents.","comfort"],
    ["The Godfather",1972,8.7,"/3bhkrj58Vtu7enYsRolD1fZdja1.jpg","/tSPT36ZKlP2WVHJLM4cQPLSzv3b.jpg","Drama · Crime","The ageing patriarch of a crime dynasty hands control to his reluctant son.","gem"],
    ["Whiplash",2014,8.4,"/7fn624j5lj3xTme2SgiLCeuedmO.jpg","/fRGxZuo7jJUWQsVg9PREb98Aclp.jpg","Drama · Music","A young drummer chases perfection under a ruthless instructor.","hype"],
    ["Oppenheimer",2023,8.0,"/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg","/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg","Drama · History","The story of J. Robert Oppenheimer and the atomic bomb.","mind"],
    ["Everything Everywhere All at Once",2022,7.7,"/u68AjlvlutfEIcpmbYpKcdi09ut.jpg","/fIwiFha3WPu5nHkBeMQ4GzEk0Hv.jpg","Action · Adventure","An ageing immigrant is swept into an adventure across the lives she could have lived.","mind"],
    ["The Pianist",2002,8.4,"/2hFvxCCWrTmCYwfy7yum0GKRi3Y.jpg","/c0fB9xk7D1aVb3Bg2rk2SVJcGn.jpg","Drama · War","A pianist's survival in Warsaw during the Nazi occupation.","cry"],
    ["Forrest Gump",1994,8.5,"/saHP97rTPS5eLmrLQEcANmKrsFl.jpg","/66Kn4XWhkuPkJxOJyPEx4U2CUfN.jpg","Comedy · Drama","A kind man with a low IQ is present for the great events of his time.","comfort"],
    ["Back to the Future",1985,8.3,"/vN5B5WgYscRGcQpVhHl6p9DDTP0.jpg","/5bzPWQ2dFUl2aZKkp7ILJVVkRed.jpg","Adventure · Comedy","Marty McFly is sent back to 1955 and disrupts his parents' first meeting.","laugh"],
    ["Mad Max: Fury Road",2015,7.6,"/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg","/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg","Action · Adventure","A desert chase where humanity is broken and everyone is fighting for survival.","hype"],
    ["La La Land",2016,7.9,"/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg","/nlPCdZlHtRNcF6C9hzUH4ebmV1w.jpg","Comedy · Drama","An actress and a jazz musician fall in love while chasing their dreams in Los Angeles.","cry"],
    ["Kumbalangi Nights",2019,8.1,"/lJ3RvIirE2C7gdBKvPRaoQ3iCo2.jpg","/8i8ml0LRdFT6LSaTMUG3gLzJfEq.jpg","Comedy · Drama","Four brothers in a fishing village share a love-hate relationship.","comfort"],
    ["Jersey",2019,8.1,"/bU9q9yVtxeBiC0Do27CekHXNE6D.jpg","/53CsGhbXKhmzcOQntz7Qs0whQ6g.jpg","Drama","A gifted cricketer in his thirties decides he is not ready to give up yet.","cry"],
    ["Drishyam",2015,7.5,"/gIClWRv5OSe8rl5Koi0AeUcCZ9Z.jpg","/5jxesZtbjNtsDitSBvK1amtd7o2.jpg","Mystery · Thriller","A commoner uses his street smarts to protect his family from criminal charges.","mind"],
    ["Vikram",2022,7.6,"/774UV1aCURb4s4JfEFg3IEMu5Zj.jpg","/dkIX4dSMuVqjfrPGunBJUR7K3LQ.jpg","Action · Crime","An agent investigates a case of serial killings that is not what it seems.","hype"],
    ["The Usual Suspects",1995,8.2,"/99X2SgyFunJFXGAYnDv3sb9pnUD.jpg","/hy0Hx9fMPk2fmw26Li60z1S2giU.jpg","Drama · Crime","The lone survivor of a heist gone wrong tells interrogators what happened.","mind"],
    ["Klaus",2019,8.2,"/q125RHUDgR4gjwh1QkfYuJLYkL.jpg","/cYQvXNPZLow73lhspVQ7CYlT3Mi.jpg","Animation · Family","A selfish postman and a reclusive toymaker bring joy to a cold, dark town.","comfort"],
    ["Toy Story 5",2026,8.3,"/sfQtVlIHljToOwYjhe21KPGzZWK.jpg","/qjTqY5coNiz6sVtPng40IzltsoN.jpg","Animation · Family","When Bonnie gets a tablet and becomes obsessed, the toys' jobs get harder.","laugh"],
    ["Meiyazhagan",2024,8.2,"/ngDEH7YqVaMCAD4LpNxRl6ScJnw.jpg","/9v5Q5OOR9e83KBlK6SPQEcbm6Iw.jpg","Family · Drama","A man returns to his home town after 22 years for a cousin's wedding.","gem"],
    ["Schindler's List",1993,8.6,"/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg","/zb6fM1CX41D9rF9hdgclu0peUmy.jpg","Drama · History","How Oskar Schindler saved over a thousand lives during the Holocaust.","cry"],
    ["The Shawshank Redemption",1994,8.7,"/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg","/pNjh59JSxChQktamG3LMp9ZoQzp.jpg","Drama · Crime","A banker sentenced for murder begins a new life inside Shawshank prison.","cry"],
    ["Fight Club",1999,8.4,"/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg","/c6OLXfKAk5BKeR6broC8pYiCquX.jpg","Drama · Thriller","An insomniac and a soap salesman start a shocking new kind of therapy.","mind"],
    ["Demon Slayer: Infinity Castle",2025,8.8,"/fWVSwgjpT2D78VUh6X8UBd2rorW.jpg","/1RgPyOhN4DRs225BGTlHJqCudII.jpg","Animation · Action","The Demon Slayer Corps face terrifying demons inside the Infinity Castle.","hype"],
    ["Facing El Chapo",2026,8.7,"/alpf5v4UqSFawPmG9RX03Or4BDk.jpg","/c4U96GrPRfnNrS01mBtqnocvlLJ.jpg","Crime · Action","Two officers must survive the last hours of their shift after crossing a cartel boss.","gem"]
  ];
  const films = raw.map(([title, year, rating, p, b, genre, plot, mood], i) => ({ id: i, title, year, rating, genre, plot, mood,
    poster: () => 'img/p/' + i + '.jpg', back: () => 'img/b/' + i + '.jpg' }));
  const by = t => films.find(f => f.title === t);
  const moods = [
    { id: 'cry', label: 'Need a good cry', blurb: 'Dramas and romances that earn the tears.' },
    { id: 'mind', label: 'Blow my mind', blurb: 'Twists, puzzles and stories that rearrange your head.' },
    { id: 'laugh', label: 'Make me laugh', blurb: 'Straight comedies, with the heavy drama left out.' },
    { id: 'comfort', label: 'Cozy & comforting', blurb: 'Warm, easy watches for a soft evening.' },
    { id: 'hype', label: 'Pure adrenaline', blurb: 'Action and adventure at full speed.' },
    { id: 'gem', label: 'Hidden gems', blurb: 'Highly rated titles most people have missed.' }
  ];
  const ofMood = id => films.filter(f => f.mood === id);
  const top10 = ['Project Hail Mary','Spider-Man: Brand New Day','Michael','The Wild Robot','Demon Slayer: Infinity Castle','Dune: Part Two','Toy Story 5','Facing El Chapo','Klaus','Oppenheimer'].map(by);
  const indian = ['Dilwale Dulhania Le Jayenge','3 Idiots','Dangal','Kumbalangi Nights','Jersey','Meiyazhagan','Drishyam','Vikram'].map(by);
  const acclaimed = ['The Godfather','The Shawshank Redemption',"Schindler's List",'The Dark Knight','Forrest Gump','Parasite','Spirited Away','Interstellar','Fight Club','The Pianist'].map(by);
  const hero = by('Project Hail Mary');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return { films, by, moods, ofMood, top10, indian, acclaimed, hero, esc };
})();
