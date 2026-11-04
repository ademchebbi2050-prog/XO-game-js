import { registerCarrier, type CarrierAdapter, type TrackingEvent } from "@/lib/carriers";

// Transporteur SIMULÉ: génère un numéro de suivi fictif + une étiquette imprimable
// + des événements de suivi déterministes (aucun appel réseau).
// Remplacer par une vraie API plus tard en enregistrant un autre adapter.

// Petits labels FR pour les événements simulés (le vrai transporteur renvoie ses propres libellés).
const EVENT_LABELS: Record<string, string> = {
  picked_up: "Colis pris en charge par le transporteur",
  in_transit: "En transit vers le gouvernorat",
  out_for_delivery: "En cours de livraison",
  delivered: "Livré",
};

export const simulatedCarrier: CarrierAdapter = {
  code: "sim",
  async createShipment(order) {
    const tracking = "SIM-" + order.number.replace(/^CMD-/, "") + "-" +
      Math.random().toString(36).slice(2, 8).toUpperCase();
    return {
      carrierId: "sim",
      trackingNumber: tracking,
      labelUrl: `/api/public/label/${tracking}`,
    };
  },
  async trackingEvents(trackingNumber, shippedAt) {
    // Événements déterministes: décalés depuis l'expédition (ou maintenant si absent).
    const base = shippedAt ? new Date(shippedAt).getTime() : Date.now();
    const steps: [number, string][] = [
      [0, "picked_up"],
      [6 * 3600e3, "in_transit"],
      [24 * 3600e3, "out_for_delivery"],
      [48 * 3600e3, "delivered"],
    ];
    const events: TrackingEvent[] = steps.map(([offset, code]) => ({
      at: new Date(base + offset).toISOString(),
      code,
      label: EVENT_LABELS[code] ?? code,
    }));
    // "Temps réel" simulé: on ne montre que les événements passés.
    return events.filter((e) => new Date(e.at).getTime() <= Date.now());
  },
};

registerCarrier(simulatedCarrier);
// Alias: les transporteurs seedés (sim-standard, sim-express) utilisent le même adapter simulé.
registerCarrier({ ...simulatedCarrier, code: "sim-standard" });
registerCarrier({ ...simulatedCarrier, code: "sim-express" });
