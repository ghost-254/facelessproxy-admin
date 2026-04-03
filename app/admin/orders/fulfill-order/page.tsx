"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type Location = {
  country: string;
  state: string;
  city: string;
  zipcode: string;
};

type ProxyDetails = {
  ip: string;
  port: string;
  username: string;
  password: string;
  protocol: "http" | "https" | "socks5";
};

type FulfillmentOrder = {
  id: string;
  status: string;
  proxyType: string;
  amount: number;
  createdAt: string | null;
  paymentOption: string | null;
  raw: {
    gbAmount?: number;
    locations?: Location[];
    proxyDetails?: Record<string, ProxyDetails>;
  };
};

const DEFAULT_PORTS = ["10000", "10001", "10002", "10003", "10004", "10005", "10006", "10007", "10008"];

function blankProxyDetails(): ProxyDetails {
  return {
    ip: "",
    port: DEFAULT_PORTS[0],
    username: "",
    password: "",
    protocol: "http",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function FulfillOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");

  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [proxyDetails, setProxyDetails] = useState<Record<string, ProxyDetails>>({});
  const [newLocation, setNewLocation] = useState<Location>({ country: "", state: "", city: "", zipcode: "" });
  const [gbAmount, setGbAmount] = useState<number | "">("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadOrder() {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}`);
        const payload = (await response.json()) as FulfillmentOrder | { error?: string };

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Unable to load order.");
        }

        if (!isMounted) {
          return;
        }

        const loadedOrder = payload as FulfillmentOrder;
        const orderLocations = Array.isArray(loadedOrder.raw.locations) ? loadedOrder.raw.locations : [];
        const existingDetails = loadedOrder.raw.proxyDetails || {};
        const initialDetails = Object.fromEntries(
          orderLocations.map((_, index) => {
            const key = `location${index + 1}`;
            return [key, existingDetails[key] || blankProxyDetails()];
          }),
        );

        setOrder(loadedOrder);
        setLocations(orderLocations);
        setProxyDetails(initialDetails);
        setGbAmount(typeof loadedOrder.raw.gbAmount === "number" ? loadedOrder.raw.gbAmount : "");
      } catch (error) {
        toast({
          title: "Unable to load order",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const canSave = useMemo(() => {
    return locations.every((_, index) => {
      const details = proxyDetails[`location${index + 1}`];
      return details && details.ip && details.port && details.username && details.password;
    });
  }, [locations, proxyDetails]);

  function updateProxyDetails(index: number, field: keyof ProxyDetails, value: string) {
    const key = `location${index + 1}`;
    setProxyDetails((current) => ({
      ...current,
      [key]: {
        ...(current[key] || blankProxyDetails()),
        [field]: value,
      },
    }));
  }

  function addLocation() {
    if (!newLocation.country || !newLocation.state || !newLocation.city) {
      toast({
        title: "Location incomplete",
        description: "Country, state, and city are required before adding a new location.",
        variant: "destructive",
      });
      return;
    }

    const updatedLocations = [...locations, newLocation];
    setLocations(updatedLocations);
    setProxyDetails((current) => ({
      ...current,
      [`location${updatedLocations.length}`]: blankProxyDetails(),
    }));
    setNewLocation({ country: "", state: "", city: "", zipcode: "" });
  }

  function removeLocation(index: number) {
    const updatedLocations = locations.filter((_, locationIndex) => locationIndex !== index);
    const updatedProxyDetails = Object.fromEntries(
      updatedLocations.map((_, locationIndex) => {
        const previousIndex = locationIndex >= index ? locationIndex + 2 : locationIndex + 1;
        return [`location${locationIndex + 1}`, proxyDetails[`location${previousIndex}`] || blankProxyDetails()];
      }),
    );

    setLocations(updatedLocations);
    setProxyDetails(updatedProxyDetails);
  }

  function togglePasswordVisibility(index: number) {
    const key = `location${index + 1}`;
    setVisiblePasswords((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleSave() {
    if (!orderId) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/fulfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "standard",
          proxyDetails,
          locations,
          gbAmount: gbAmount === "" ? null : gbAmount,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save fulfillment details.");
      }

      toast({
        title: "Fulfillment saved",
        description: "The order was updated and marked as fulfilled.",
      });
      router.push("/admin/orders");
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to fulfill order.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setConfirmOpen(false);
    }
  }

  if (isLoading) {
    return <div className="rounded-[28px] border border-white/70 bg-white/80 p-8 text-sm text-slate-600">Loading fulfillment workspace...</div>;
  }

  if (!order || !orderId) {
    return <div className="rounded-[28px] border border-red-100 bg-red-50 p-8 text-sm text-red-700">Order not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,118,110,0.88))] text-white shadow-xl shadow-slate-900/10">
        <CardHeader>
          <CardDescription className="text-white/70">Standard fulfillment</CardDescription>
          <CardTitle className="font-display text-3xl">Enter the delivery details and save the order.</CardTitle>
        </CardHeader>
      </Card>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Order profile</CardDescription>
          <CardTitle className="font-display text-2xl">{order.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Product</TableCell>
                <TableCell>{order.proxyType}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Status</TableCell>
                <TableCell className="capitalize">{order.status}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Amount</TableCell>
                <TableCell>{formatCurrency(order.amount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Payment option</TableCell>
                <TableCell>{order.paymentOption || "Custom"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Created</TableCell>
                <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleString() : "Unknown"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">GB amount</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={gbAmount}
                    onChange={(event) => setGbAmount(event.target.value ? Number(event.target.value) : "")}
                    className="max-w-[160px] rounded-2xl border-white/70 bg-white/80"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {locations.map((location, index) => (
        <Card key={`${location.city}-${index}`} className="rounded-[28px] border-white/80 bg-white/80">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardDescription>Location {index + 1}</CardDescription>
              <CardTitle className="font-display text-2xl">{[location.city, location.state, location.country].filter(Boolean).join(", ")}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeLocation(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select
                value={proxyDetails[`location${index + 1}`]?.protocol || "http"}
                onValueChange={(value: "http" | "https" | "socks5") => updateProxyDetails(index, "protocol", value)}
              >
                <SelectTrigger className="rounded-2xl border-white/70 bg-white/80">
                  <SelectValue placeholder="Select protocol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Select value={proxyDetails[`location${index + 1}`]?.port || DEFAULT_PORTS[0]} onValueChange={(value) => updateProxyDetails(index, "port", value)}>
                <SelectTrigger className="rounded-2xl border-white/70 bg-white/80">
                  <SelectValue placeholder="Select port" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_PORTS.map((port) => (
                    <SelectItem key={port} value={port}>
                      {port}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>IP address</Label>
              <Input
                value={proxyDetails[`location${index + 1}`]?.ip || ""}
                onChange={(event) => updateProxyDetails(index, "ip", event.target.value)}
                className="rounded-2xl border-white/70 bg-white/80"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={proxyDetails[`location${index + 1}`]?.username || ""}
                onChange={(event) => updateProxyDetails(index, "username", event.target.value)}
                className="rounded-2xl border-white/70 bg-white/80"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={visiblePasswords[`location${index + 1}`] ? "text" : "password"}
                  value={proxyDetails[`location${index + 1}`]?.password || ""}
                  onChange={(event) => updateProxyDetails(index, "password", event.target.value)}
                  className="rounded-2xl border-white/70 bg-white/80 pr-11"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(index)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 transition hover:text-slate-800"
                  aria-label={visiblePasswords[`location${index + 1}`] ? "Hide password" : "Show password"}
                >
                  {visiblePasswords[`location${index + 1}`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zip code</Label>
              <Input value={location.zipcode} readOnly className="rounded-2xl border-white/70 bg-slate-50" />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Add delivery target</CardDescription>
          <CardTitle className="font-display text-2xl">Add another location if this order needs to be updated.</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input placeholder="Country" value={newLocation.country} onChange={(event) => setNewLocation((current) => ({ ...current, country: event.target.value }))} className="rounded-2xl border-white/70 bg-white/80" />
          <Input placeholder="State" value={newLocation.state} onChange={(event) => setNewLocation((current) => ({ ...current, state: event.target.value }))} className="rounded-2xl border-white/70 bg-white/80" />
          <Input placeholder="City" value={newLocation.city} onChange={(event) => setNewLocation((current) => ({ ...current, city: event.target.value }))} className="rounded-2xl border-white/70 bg-white/80" />
          <Input placeholder="Zip code" value={newLocation.zipcode} onChange={(event) => setNewLocation((current) => ({ ...current, zipcode: event.target.value }))} className="rounded-2xl border-white/70 bg-white/80" />
          <div className="md:col-span-2 xl:col-span-4">
            <Button variant="outline" className="rounded-2xl border-white/70 bg-white/80" onClick={addLocation}>
              <Plus className="mr-2 h-4 w-4" />
              Add location
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="rounded-2xl border-white/70 bg-white/80" onClick={() => router.push("/admin/orders")}>
          Cancel
        </Button>
        <Button className="rounded-2xl" disabled={!canSave || isSaving} onClick={() => setConfirmOpen(true)}>
          {isSaving ? "Saving..." : "Mark as Fulfilled"}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-[28px] border-white/80 bg-white/95">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Confirm fulfillment</DialogTitle>
            <DialogDescription>
              This will save the proxy credentials and mark the order as fulfilled in Firebase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setConfirmOpen(false)}>
              Review again
            </Button>
            <Button className="rounded-2xl" onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Saving..." : "Confirm Fulfillment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
