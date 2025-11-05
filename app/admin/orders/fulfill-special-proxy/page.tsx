"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebaseConfig"
import { Save, Plus, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

const SOCKS5_PORTS = [
  "12324",
  "63267",
  "63331",
  "63561",
  "15324",
  "22326",
  "7777",
  "22324",
  "22325",
  "10324",
  "11324",
  "13324",
  "14324",
]
const HTTP_HTTPS_PORTS = [
  "12323",
  "63330",
  "63266",
  "63560",
  "10323",
  "11323",
  "7777",
  "12325",
  "12326",
  "13323",
  "14323",
  "15323",
  "22323",
]

export default function FulfillSpecialProxyOrder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("id")

  const [order, setOrder] = useState<Order | null>(null)
  const [proxyList, setProxyList] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [host, setHost] = useState("")
  const [port, setPort] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [protocol, setProtocol] = useState("SOCKS5")
  const [customPorts, setCustomPorts] = useState<string[]>([])
  const [newCustomPort, setNewCustomPort] = useState("")

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        toast({
          title: "Error",
          description: "No order ID provided",
          variant: "destructive",
        })
        router.push("/admin/orders")
        return
      }

      setIsLoading(true)
      try {
        const orderDoc = await getDoc(doc(db, "orders", orderId))
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as Order
          if (!orderData.isSpecialProxy) {
            toast({
              title: "Error",
              description: "This is not a special proxy order",
              variant: "destructive",
            })
            router.push("/admin/orders")
            return
          }
          setOrder({ ...orderData, id: orderDoc.id })
          setProxyList(orderData.proxyList || [])
        } else {
          toast({
            title: "Error",
            description: "Order not found",
            variant: "destructive",
          })
          router.push("/admin/orders")
        }
      } catch (error) {
        console.error("Error fetching order:", error)
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive",
        })
        router.push("/admin/orders")
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, router])

  useEffect(() => {
    // Set default port when protocol changes
    if (protocol === "SOCKS5") {
      setPort(SOCKS5_PORTS[0])
    } else {
      setPort(HTTP_HTTPS_PORTS[0])
    }
  }, [protocol])

  const handleAddCustomPort = () => {
    if (!newCustomPort.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid port number",
        variant: "destructive",
      })
      return
    }

    // Validate port is a number between 0 and 65535
    const portNum = Number.parseInt(newCustomPort)
    if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
      toast({
        title: "Error",
        description: "Port must be a number between 0 and 65535",
        variant: "destructive",
      })
      return
    }

    // Check if port already exists
    const allPorts = [...SOCKS5_PORTS, ...HTTP_HTTPS_PORTS, ...customPorts]
    if (allPorts.includes(newCustomPort)) {
      toast({
        title: "Error",
        description: "This port already exists",
        variant: "destructive",
      })
      return
    }

    setCustomPorts([...customPorts, newCustomPort])
    setNewCustomPort("")
    toast({
      title: "Success",
      description: `Port ${newCustomPort} added successfully`,
    })
  }

  const handleRemoveCustomPort = (portToRemove: string) => {
    setCustomPorts(customPorts.filter((p) => p !== portToRemove))
    toast({
      title: "Removed",
      description: `Port ${portToRemove} has been removed`,
    })
  }

  const handleAddProxy = () => {
    if (host && port && username && password) {
      const newProxy = `${protocol}://${username}:${password}@${host}:${port}`
      setProxyList([...proxyList, newProxy])
      setHost("")
      setUsername("")
      setPassword("")
    } else {
      toast({
        title: "Error",
        description: "Please fill in all proxy details",
        variant: "destructive",
      })
    }
  }

  const handleRemoveProxy = (index: number) => {
    setProxyList(proxyList.filter((_, i) => i !== index))
  }

  const handleSaveOrder = async () => {
    if (!order) return

    setIsLoading(true)
    try {
      const orderRef = doc(db, "orders", order.id)
      await updateDoc(orderRef, {
        status: "Fulfilled",
        proxyList: proxyList,
      })

      toast({
        title: "Order Fulfilled",
        description: `Order ${order.id} has been successfully fulfilled.`,
      })

      router.push("/admin/orders")
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

  const availablePorts =
    protocol === "SOCKS5" ? [...SOCKS5_PORTS, ...customPorts] : [...HTTP_HTTPS_PORTS, ...customPorts]

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

      <Card>
        <CardHeader>
          <CardTitle>Custom Ports</CardTitle>
          <CardDescription>Add additional ports beyond the predefined options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter port number (0-6553500000)"
              value={newCustomPort}
              onChange={(e) => setNewCustomPort(e.target.value)}
              type="number"
              min="0"
              max="65535000000"
            />
            <Button onClick={handleAddCustomPort} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Port
            </Button>
          </div>

          {customPorts.length > 0 && (
            <div className="border rounded-lg p-4 bg-slate-50">
              <p className="text-sm font-medium mb-2">Active Custom Ports:</p>
              <div className="flex flex-wrap gap-2">
                {customPorts.map((customPort) => (
                  <div
                    key={customPort}
                    className="bg-white border border-gray-200 rounded px-3 py-1 flex items-center gap-2"
                  >
                    <span className="text-sm">{customPort}</span>
                    <button
                      onClick={() => handleRemoveCustomPort(customPort)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                {availablePorts.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} />
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
            />
          </div>

          <Button onClick={handleAddProxy}>Add Proxy</Button>

          <Textarea className="font-mono" value={proxyList.join("\n")} readOnly rows={4} />

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
                    <Button variant="destructive" onClick={() => handleRemoveProxy(index)}>
                      Remove
                    </Button>
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
