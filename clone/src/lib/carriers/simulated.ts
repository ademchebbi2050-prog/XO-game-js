import { registerCarrier, type CarrierAdapter } from "@/lib/carriers";

// Transporteur SIMULÉ: génère un numéro de suivi fictif, aucun appel réseau.
// Remplacer par une vraie API plus tard en enregistrant un autre adapter.
export const simulatedCarrier: CarrierAdapter = {
  code: "sim",
  async createShipment(order) {
    const tracking = "SIM-" + order.number.replace(/^CMD-/, "") + "-" +
      Math.random().toString(36).slice(2, 8).toUpperCase();
    return { carrierId: "sim", trackingNumber: tracking };
  },
};

registerCarrier(simulatedCarrier);
