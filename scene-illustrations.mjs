export const illustrationFamilies=['coffee','street','travel','hotel','home','shop','health','work','social','civic'];
const groups={coffee:['coffee','milk','sugar','bill','complaint','swearing','thanks'],travel:['airport','ticket'],hotel:['hotel'],home:['rent','repair','family'],shop:['market','size','card'],health:['health'],work:['internet','work','study'],social:['friends','invite','dating','consent','refuse','feelings','leisure'],civic:['documents']};
export function illustrationFamily(id){return Object.keys(groups).find(key=>groups[key].includes(id))||'street';}
