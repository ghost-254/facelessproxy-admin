"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type SpecialOrder = {
  id: string;
  status: string;
  proxyType: string;
  amount: number;
  createdAt: string | null;
  raw: {
    location?: string;
    duration?: string;
    proxyCount?: number;
    proxyList?: string[];
  };
};

const SOCKS5_PORTS = ["12324", "63267", "63331", "63561", "15324", "22326", "7777", "22324", "22325", "10324"];
const HTTP_PORTS = ["12323", "63330", "63266", "63560", "10323", "11323", "7777", "12325", "12326", "13323"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function FulfillSpecialProxyOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id");

  const [order, setOrder] = useState<SpecialOrder | null>(null);
  const [proxyList, setProxyList] = useState<string[]>([]);
  const [protocol, setProtocol] = useState("SOCKS5");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(SOCKS5_PORTS[0]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customPorts, setCustomPorts] = useState<string[]>([]);
  const [newCustomPort, setNewCustomPort] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadOrder() {
      try {
        const response = await fetch(`/api/admin/orders/${orderId}`);
        const payload = (await response.json()) as SpecialOrder | { error?: string };

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Unable to load order.");
        }

        if (!isMounted) {
          return;
        }

        const loadedOrder = payload as SpecialOrder;
        setOrder(loadedOrder);
        setProxyList(Array.isArray(loadedOrder.raw.proxyList) ? loadedOrder.raw.proxyList : []);
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

  useEffect(() => {
    setPort(protocol === "SOCKS5" ? SOCKS5_PORTS[0] : HTTP_PORTS[0]);
  }, [protocol]);

  const availablePorts = useMemo(() => {
    return protocol === "SOCKS5" ? [...SOCKS5_PORTS, ...customPorts] : [...HTTP_PORTS, ...customPorts];
  }, [customPorts, protocol]);

  const expectedProxyCount = order?.raw.proxyCount || 0;

  function addProxy() {
    if (!host || !port || !username || !password) {
      toast({
        title: "Proxy details missing",
        description: "Fill in host, port, username, and password before adding a proxy.",
        variant: "destructive",
      });
      return;
    }

    const newProxy = `${protocol}://${username}:${password}@${host}:${port}`;
    setProxyList((current) => [...current, newProxy]);
    setHost("");
    setUsername("");
    setPassword("");
  }

  function addCustomPort() {
    const sanitizedPort = newCustomPort.trim();
    const portNumber = Number(sanitizedPort);

    if (!sanitizedPort || Number.isNaN(portNumber) || portNumber < 0 || portNumber > 65535) {
      toast({
        title: "Invalid port",
        description: "Use a port number between 0 and 65535.",
        variant: "destructive",
      });
      return;
    }

    if (availablePorts.includes(sanitizedPort)) {
      toast({
        title: "Port already exists",
        description: "Choose a different custom port.",
        variant: "destructive",
      });
      return;
    }

    setCustomPorts((current) => [...current, sanitizedPort]);
    setNewCustomPort("");
  }

  async function saveFulfillment() {
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
          mode: "special",
          proxyList,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to save this fulfillment.");
      }

      toast({
        title: "Special order fulfilled",
        description: "The proxy list was saved and the order was marked as fulfilled.",
      });
      router.push("/admin/orders");
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save this order.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
      <Card className="rounded-[28px] border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(14,165,233,0.82))] text-white shadow-xl shadow-slate-900/10">
        <CardHeader>
          <CardDescription className="text-white/70">Special proxy fulfillment</CardDescription>
          <CardTitle className="font-display text-3xl">Add the proxy list and confirm the final quantity before saving.</CardTitle>
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
                <TableCell className="font-medium">Location</TableCell>
                <TableCell>{order.raw.location || "Flexible"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Plan</TableCell>
                <TableCell>{order.raw.duration || "Custom"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Expected proxies</TableCell>
                <TableCell>{expectedProxyCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Amount</TableCell>
                <TableCell>{formatCurrency(order.amount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Custom ports</CardDescription>
          <CardTitle className="font-display text-2xl">Add any extra ports needed for this order.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              type="number"
              value={newCustomPort}
              onChange={(event) => setNewCustomPort(event.target.value)}
              placeholder="Add custom port"
              className="rounded-2xl border-white/70 bg-white/80"
            />
            <Button variant="outline" className="rounded-2xl border-white/70 bg-white/80" onClick={addCustomPort}>
              <Plus className="mr-2 h-4 w-4" />
              Add port
            </Button>
          </div>

          {customPorts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customPorts.map((customPort) => (
                <button
                  type="button"
                  key={customPort}
                  onClick={() => setCustomPorts((current) => current.filter((entry) => entry !== customPort))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  {customPort}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Proxy builder</CardDescription>
          <CardTitle className="font-display text-2xl">Build the proxy list and verify the final count.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger className="rounded-2xl border-white/70 bg-white/80">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="HTTPS">HTTPS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={port} onValueChange={setPort}>
              <SelectTrigger className="rounded-2xl border-white/70 bg-white/80">
                <SelectValue placeholder="Port" />
              </SelectTrigger>
              <SelectContent>
                {availablePorts.map((availablePort) => (
                  <SelectItem key={availablePort} value={availablePort}>
                    {availablePort}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={host} onChange={(event) => setHost(event.target.value)} placeholder="Host" className="rounded-2xl border-white/70 bg-white/80" />
            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" className="rounded-2xl border-white/70 bg-white/80" />
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="rounded-2xl border-white/70 bg-white/80" />
          </div>

          <Button className="rounded-2xl" onClick={addProxy}>
            <Plus className="mr-2 h-4 w-4" />
            Add proxy line
          </Button>

          <Textarea value={proxyList.join("\n")} readOnly rows={6} className="rounded-2xl border-white/70 bg-slate-50 font-mono text-xs" />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proxy</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxyList.map((proxy, index) => (
                <TableRow key={`${proxy}-${index}`}>
                  <TableCell className="font-mono text-xs">{proxy}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" className="rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setProxyList((current) => current.filter((_, proxyIndex) => proxyIndex !== index))}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/80 bg-white/80">
        <CardHeader>
          <CardDescription>Ready check</CardDescription>
          <CardTitle className="font-display text-2xl">Save the order once the delivered quantity matches the purchase.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {proxyList.length !== expectedProxyCount ? (
            <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
              <AlertDescription>
                You currently have {proxyList.length} proxies configured, but the order expects {expectedProxyCount}.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-2xl border-white/70 bg-white/80" onClick={() => router.push("/admin/orders")}>
              Cancel
            </Button>
            <Button className="rounded-2xl" disabled={proxyList.length !== expectedProxyCount || isSaving} onClick={saveFulfillment}>
              {isSaving ? "Saving..." : "Save and Fulfill"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
