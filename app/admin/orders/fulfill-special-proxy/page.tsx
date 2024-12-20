'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Save } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"

interface Order {
  id: string
  status: string
  createdAt: string
  proxyType: string
  paymentMethod: string
  totalPrice: number
  location: string
  duration: string
  proxyCount: number
  isSpecialProxy: boolean
  proxyList?: string[]
}

const SOCKS5_PORTS = ['10000', '10001', '10002', '10003', '10004', '10005', '10006', '10007', '10008']
const HTTP_HTTPS_PORTS = ['10000', '10001', '10002', '10003', '10004', '10005', '10006', '10007', '10008']

export default function FulfillSpecialProxyOrder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('id')

  const [order, setOrder] = useState<Order | null>(null)
  const [proxyList, setProxyList] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [host, setHost] = useState("")
  const [port, setPort] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [protocol, setProtocol] = useState("SOCKS5")

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        toast({
          title: "Error",
          description: "No order ID provided",
          variant: "destructive",
        });
        router.push('/admin/orders');
        return;
      }

      setIsLoading(true);
      try {
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as Order;
          if (!orderData.isSpecialProxy) {
            toast({
              title: "Error",
              description: "This is not a special proxy order",
              variant: "destructive",
            });
            router.push('/admin/orders');
            return;
          }
          setOrder({ ...orderData, id: orderDoc.id });
          setProxyList(orderData.proxyList || []);
        } else {
          toast({
            title: "Error",
            description: "Order not found",
            variant: "destructive",
          });
          router.push('/admin/orders');
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive",
        });
        router.push('/admin/orders');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, router]);

  useEffect(() => {
    // Set default port when protocol changes
    if (protocol === 'SOCKS5') {
      setPort(SOCKS5_PORTS[0]);
    } else {
      setPort(HTTP_HTTPS_PORTS[0]);
    }
  }, [protocol]);

  const handleAddProxy = () => {
    if (host && port && username && password) {
      const newProxy = `${protocol}://${username}:${password}@${host}:${port}`;
      setProxyList([...proxyList, newProxy]);
      setHost("");
      setUsername("");
      setPassword("");
    } else {
      toast({
        title: "Error",
        description: "Please fill in all proxy details",
        variant: "destructive",
      });
    }
  }

  const handleRemoveProxy = (index: number) => {
    setProxyList(proxyList.filter((_, i) => i !== index))
  }

  const handleSaveOrder = async () => {
    if (!order) return

    setIsLoading(true)
    try {
      const orderRef = doc(db, 'orders', order.id)
      await updateDoc(orderRef, {
        status: "Fulfilled",
        proxyList: proxyList,
      })

      toast({
        title: "Order Fulfilled",
        description: `Order ${order.id} has been successfully fulfilled.`,
      })

      router.push('/admin/orders')
    } catch (error) {
      console.error("Error updating order:", error)
      toast({
        title: "Error",
        description: "Failed to fulfill order",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!order) {
    return <div>Order not found</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Fulfill Special Proxy Order</h1>
      
      {/* Order Details */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Order #{order.id}</CardDescription>
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
                <TableCell>{order.status}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Plan</TableCell>
                <TableCell>{order.duration}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Location</TableCell>
                <TableCell>{order.location}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Expire date</TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Number of proxies</TableCell>
                <TableCell>{order.proxyCount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Final price</TableCell>
                <TableCell>${order.totalPrice.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Proxy List Management */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Proxy List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger>
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SOCKS5">SOCKS5</SelectItem>
                <SelectItem value="HTTP">HTTP</SelectItem>
                <SelectItem value="HTTPS">HTTPS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={port} onValueChange={setPort}>
              <SelectTrigger>
                <SelectValue placeholder="Select port" />
              </SelectTrigger>
              <SelectContent>
                {(protocol === 'SOCKS5' ? SOCKS5_PORTS : HTTP_HTTPS_PORTS).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
          </div>

          <Button onClick={handleAddProxy}>Add Proxy</Button>

          <Textarea
            className="font-mono"
            value={proxyList.join('\n')}
            readOnly
            rows={4}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proxy</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxyList.map((proxy, index) => (
                <TableRow key={index}>
                  <TableCell>{proxy}</TableCell>
                  <TableCell>
                    <Button variant="destructive" onClick={() => handleRemoveProxy(index)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Save Order */}
      <Card>
        <CardHeader>
          <CardTitle>Fulfill Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSaveOrder} disabled={proxyList.length !== order.proxyCount || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            Save and Fulfill Order
          </Button>
          {proxyList.length !== order.proxyCount && (
            <Alert className="mt-4">
              <AlertDescription>
                The number of proxies ({proxyList.length}) does not match the order quantity ({order.proxyCount}).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
