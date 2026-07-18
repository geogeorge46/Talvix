export const isOfferExpired=(offer,now=new Date())=>Boolean(offer.expiresAt&&offer.expiresAt<=now);export const calculateOfferExpiry=(days,from=new Date())=>new Date(from.getTime()+days*86400000);
