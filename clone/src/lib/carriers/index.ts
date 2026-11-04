// Interface transporteur: l'app ne dépend JAMAIS d'un transporteur réel.
// Implémentation MVP: simulated.ts. Brancher une vraie API = nouveau fichier
// implémentant CarrierAdapter, aucun changement côté métier.

export interface ShipmentResult {
  carrierId: string;
  trackingNumber: string;
  labelUrl?: string;
}

export interface TrackingEvent {
  at: string; // ISO
  code: string; // picked_up | in_transit | out_for_delivery | delivered
  label: string;
}

export interface CarrierAdapter {
  code: string;
  createShipment(order: {
    id: string;
    number: string;
    customerName: string;
    customerPhone: string;
    address: string;
    governorate: string;
    totalMinor: number;
  }): Promise<ShipmentResult>;
  /** Suivi temps réel (optionnel). Le simulé génère des événements déterministes. */
  trackingEvents?(trackingNumber: string, shippedAt?: string | null): Promise<TrackingEvent[]>;
}

const adapters = new Map<string, CarrierAdapter>();

export function registerCarrier(adapter: CarrierAdapter) {
  adapters.set(adapter.code, adapter);
}

export function getCarrier(code: string): CarrierAdapter | undefined {
  return adapters.get(code);
}
