import ecoli from "@/assets/micro-ecoli.jpg";
import saureus from "@/assets/micro-saureus.jpg";
import kpneu from "@/assets/micro-kpneu.jpg";
import efaecalis from "@/assets/micro-efaecalis.jpg";

export const microImages = [
  { key: "ecoli", src: ecoli, organism: "Escherichia coli", gram: "−", shape_en: "rods (bacilli)", shape_fi: "sauvat (basillit)", specimens: "urine, blood, wound" },
  { key: "saureus", src: saureus, organism: "Staphylococcus aureus", gram: "+", shape_en: "cocci in clusters", shape_fi: "kokit rypäleinä", specimens: "wound, blood" },
  { key: "kpneu", src: kpneu, organism: "Klebsiella pneumoniae", gram: "−", shape_en: "encapsulated rods", shape_fi: "kapselilliset sauvat", specimens: "urine, blood" },
  { key: "efaecalis", src: efaecalis, organism: "Enterococcus faecalis", gram: "+", shape_en: "cocci in pairs/chains", shape_fi: "kokit pareina/ketjuina", specimens: "urine, wound" },
] as const;

export function imageForOrganism(org: string) {
  return microImages.find((m) => m.organism === org) ?? (org.startsWith("Klebsiella") || org.startsWith("Citrobacter") || org.startsWith("Proteus") ? microImages[2] : org.startsWith("Staphylococcus") ? microImages[1] : null);
}
