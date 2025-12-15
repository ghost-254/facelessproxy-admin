// app/admin/clients/page.tsx (Final fixed version)
"use client"

import { useEffect, useState } from "react"
import AdminHeader from "@/components/admin/Header"
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebaseConfig"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Send, Search, Users, UserPlus, Mail, MailCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

// Helper: Safely convert Firestore timestamp to JS Date
const timestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null

  // Firestore Timestamp object
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    return timestamp.toDate()
  }

  // Plain object with seconds/nanoseconds (from getDocs)
  if (timestamp.seconds != null) {
    return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000)
  }

  // Already a Date or string
  if (timestamp instanceof Date) {
    return timestamp
  }
  if (typeof timestamp === "string") {
    return new Date(timestamp)
  }

  return null
}

interface Client {
  id: string
  email: string
  createdAt: any
  lastMessaged?: any
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [messageSubject, setMessageSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true)
      try {
        const snapshot = await getDocs(collection(db, "users"))
        const fetchedClients = snapshot.docs.map((doc) => ({
          id: doc.id,
          email: doc.data().email || "no-email@unknown.com",
          createdAt: doc.data().createdAt,
          lastMessaged: doc.data().lastMessaged || null,
        })) as Client[]

        setClients(fetchedClients)
        setFilteredClients(fetchedClients)
      } catch (error) {
        console.error("Failed to fetch clients:", error)
        toast({ title: "Error", description: "Failed to load clients", variant: "destructive" })
      } finally {
        setIsLoading(false)
      }
    }

    fetchClients()
  }, [])

  useEffect(() => {
    const filtered = clients.filter(client =>
      client.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredClients(filtered)
  }, [searchTerm, clients])

  const handleSelectClient = (id: string) => {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(filteredClients.map(c => c.id))
    }
  }

  const handleSendMessage = async () => {
    if (!messageSubject || !messageBody || selectedClients.length === 0) {
      toast({ title: "Error", description: "Please fill all fields and select clients", variant: "destructive" })
      return
    }

    try {
      const updates = selectedClients.map(id =>
        updateDoc(doc(db, "users", id), { lastMessaged: serverTimestamp() })
      )
      await Promise.all(updates)

      // Update local state
      setClients(prev => prev.map(c =>
        selectedClients.includes(c.id)
          ? { ...c, lastMessaged: new Date() }
          : c
      ))

      toast({ title: "Success", description: `Message sent to ${selectedClients.length} clients` })
      setDialogOpen(false)
      setSelectedClients([])
      setMessageSubject("")
      setMessageBody("")
    } catch (error) {
      console.error("Send failed:", error)
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" })
    }
  }

  const handleViewClient = (client: Client) => {
    setSelectedClient(client)
    setViewDialogOpen(true)
  }

  const formatDate = (timestamp: any): string => {
    const date = timestampToDate(timestamp)
    return date ? date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Unknown"
  }

  // Stats calculations
  const totalClients = clients.length
  const newlySignedUp = clients.filter(client => {
    const date = timestampToDate(client.createdAt)
    if (!date) return false
    return (Date.now() - date.getTime()) < 30 * 24 * 60 * 60 * 1000 // 30 days
  }).length
  const messagedClients = clients.filter(c => timestampToDate(c.lastMessaged)).length
  const nonMessagedClients = totalClients - messagedClients

  if (isLoading) {
    return (
      <>
        <AdminHeader />
        <div className="container mx-auto px-4 py-8 text-center">Loading clients...</div>
      </>
    )
  }

  return (
    <>
      <AdminHeader />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Manage Clients</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New (30 days)</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{newlySignedUp}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messaged</CardTitle>
              <MailCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messagedClients}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Never Messaged</CardTitle>
              <Mail className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nonMessagedClients}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between mb-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={selectedClients.length === 0}>
                <Send className="mr-2 h-4 w-4" /> Send Message ({selectedClients.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Send Message</DialogTitle>
                <DialogDescription>
                  To {selectedClients.length} client{selectedClients.length > 1 ? "s" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Subject</Label>
                  <Input value={messageSubject} onChange={e => setMessageSubject(e.target.value)} />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={messageBody}
                    onChange={e => setMessageBody(e.target.value)}
                    rows={8}
                    placeholder="Write your promotional message here..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSendMessage}>Send Message</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Messaged</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={() => handleSelectClient(client.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{client.email}</TableCell>
                  <TableCell>{formatDate(client.createdAt)}</TableCell>
                  <TableCell>
                    {client.lastMessaged ? formatDate(client.lastMessaged) : <span className="text-muted-foreground">Never</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewClient(client)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* View Client Modal */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Client Profile</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-4 py-4">
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{selectedClient.email}</p>
                </div>
                <div>
                  <Label>Member Since</Label>
                  <p>{formatDate(selectedClient.createdAt)}</p>
                </div>
                <div>
                  <Label>Last Messaged</Label>
                  <p>{selectedClient.lastMessaged ? formatDate(selectedClient.lastMessaged) : "Never"}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}