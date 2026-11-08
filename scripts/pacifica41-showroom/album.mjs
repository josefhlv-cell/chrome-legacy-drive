/** Public catalog identity checked read-only on 2026-11-08. */
export const VEHICLE = {
  id: "068bb432-aa29-4513-b4cb-b21eaa0f48df",
  source_feed_id: "417",
  name: "Chrysler Pacifica 3,6 RU Limited Radar 360 2022",
  inventory_number: "41",
  price_with_vat: 729000,
  currency: "CZK",
  year: 2022,
  vin: "2C4RC1GG7NR153169",
  color: "Šedá metalíza",
  mileage_km: 151000,
  fuel: "Ba 95",
  status: "skladem",
  listing_image_url: "https://chrysler-pardubice.cz/chrysler_server/uploads/01-prava-prednii.jpg",
  show_room_enabled: false,
  show_room_images_count: 0,
};

const ROOT = "https://chrysler-pardubice.cz/chrysler_server/uploads/";

/**
 * Album order is the Vehicle.php `url` list for this VIN.
 * disposition:
 * - exterior: full vehicle outside, showroom composite is meaningful
 * - unsuitable: interior or detail, not reported as a showroom success
 * - absent: listed URL returned HTTP 404 and no storage copy exists
 * - not_in_album: step from the 20-shot capture sequence with no URL in the feed
 */
export const ALBUM = [
  entry(1, "01-prava-prednii.jpg", "prava-predni", "exterior", "title", "Pravý přední třičtvrtinový pohled na šedou Pacificu. Titulní fotka. Soubor má v názvu překlep prednii."),
  entry(2, "02-leva-predni.jpg", "leva-predni", "absent", null, "URL je v albu, server vrací HTTP 404. Storage soubor 1.jpg neexistuje."),
  entry(3, "03-leva-zadni.jpg", "leva-zadni", "absent", null, "URL je v albu, server vrací HTTP 404. Storage soubor 2.jpg neexistuje."),
  entry(4, "04-prava-zadni.jpg", "prava-zadni", "absent", null, "URL je v albu, server vrací HTTP 404. Storage soubor 3.jpg neexistuje."),
  entry(5, "05-predek.jpg", "predek", "exterior", null, "Soubor se jmenuje předek, na snímku je záď vozu. Celý exteriér, vhodný pro showroom."),
  entry(6, "06-kufr.jpg", "kufr", "exterior", null, "Soubor se jmenuje kufr, na snímku je příď vozu. Celý exteriér, vhodný pro showroom."),
  entry(7, "07-sedacky-zezadu.jpg", "sedacky-zezadu", "unsuitable", null, "Pohled do kufru na zadní stranu sedaček. Interiér, bez celého vozu."),
  entry(8, "08-prava-stredni-sedacka.jpg", "prava-stredni-sedacka", "unsuitable", null, "Interiér, sedačky. Nevhodné pro showroom výřez vozu."),
  entry(9, "09-prava-predni-sedacka.jpg", "prava-predni-sedacka", "unsuitable", null, "Interiér, přední sedačka. Nevhodné pro showroom výřez vozu."),
  entry(10, "10-dvd.jpg", "dvd", "unsuitable", null, "Interiér. Název říká DVD, snímek není celý vůz v exteriéru."),
  entry(11, "11-pristrojovka-zprostred.jpg", "pristrojovka-zprostred", "unsuitable", null, "Přístrojová deska. Detail interiéru."),
  entry(12, "12-leva-stredni-sedacka.jpg", "leva-stredni-sedacka", "unsuitable", null, "Interiér, sedačka. Nevhodné pro showroom výřez vozu."),
  entry(13, "13-zprostred-predek-ridic.jpg", "zprostred-predek-ridic", "unsuitable", null, "Pohled na místo řidiče. Interiér."),
  entry(14, "14-dvere-ridic.jpg", "dvere-ridic", "unsuitable", null, "Výplň dveří. Detail interiéru."),
  entry(15, "15-km.jpg", "km", "unsuitable", null, "Sdružený přístroj. Detail."),
  entry(16, "16-stredovy-panel.jpg", "stredovy-panel", "unsuitable", null, "Středový panel. Detail interiéru."),
  entry(17, "17-vrch-stropnice.jpg", "vrch-stropnice", "unsuitable", null, "Stropnice. Detail interiéru."),
  entry(18, "18-detail-klima.jpg", "detail-klima", "not_in_album", null, "Krok sekvence Smart Capture v URL seznamu alba není. Soubor na serveru není."),
  entry(19, "19-vin-za-oknem.jpg", "vin-za-oknem", "unsuitable", null, "Název říká VIN za oknem. Na snímku je volant a přístroje, ne štítek VIN."),
  entry(20, "20-vin-za-oknem.jpg", "vin-za-oknem", "absent", null, "Druhé VIN URL v albu vrací HTTP 404."),
  entry(21, "05-zadek.jpg", "zadek", "not_in_album", null, "Krok sekvence zadek v URL seznamu alba není. Záď je ve snímku pojmenovaném 05-predek.jpg."),
];

function entry(index, filename, shotType, disposition, role, observed) {
  return {
    index,
    filename,
    url: `${ROOT}${filename}`,
    shot_type: shotType,
    disposition,
    role,
    observed,
  };
}

export const STORAGE_PREFIX = "068bb432-aa29-4513-b4cb-b21eaa0f48df";
