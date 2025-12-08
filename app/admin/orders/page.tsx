"use client"

import { useEffect, useState } from "react"
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebaseConfig"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Trash2, Eye, AlertTriangle, X } from "lucide-react"
import { ToastContainer, toast } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import Modal from "@/components/ui/modal"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import type { ToastContentProps } from "react-toastify"

interface OrderDetails {
  proxyType: string
  isSpecialProxy: boolean
  location?: string
  duration?: string
  quantity?: number
  gbAmount?: number
  additionalGb?: number
  selectedTier?: {
    gb: number
    price: number
    discount?: string
  }
  paymentOption?: "subscription" | "onetime"
  totalPrice: number
  locations?: any[]
}

interface Order {
  id: string
  status: string
  createdAt: string
  paymentMethod: string
  totalAmount: number
  paymentStatus?: string
  orderDetails?: OrderDetails
  // For backward compatibility with non-Visa orders
  proxyType?: string
  totalPrice?: number
  location?: string
  duration?: string
  proxyCount?: number
  isSpecialProxy?: boolean
  gbAmount?: number
  additionalGb?: number
  selectedTier?: {
    gb: number
    discount: string
    price: number
  }
  paymentOption?: string
  referredBy?: string | null
  dodoProductId?: string
}

interface DeleteConfirmation {
  orderId: string
  confirmed: boolean
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter, setDateToFilter] = useState("")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all")
  const [productTypeFilter, setProductTypeFilter] = useState("all")
  const [uniquePaymentMethods, setUniquePaymentMethods] = useState<string[]>([])
  const [uniqueProductTypes, setUniqueProductTypes] = useState<string[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null)
  const router = useRouter()

  const CustomToast = ({ closeToast, orderId }: { closeToast: ToastContentProps["closeToast"]; orderId: string }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-auto">
      <div className="flex items-center mb-4">
        <AlertTriangle className="text-yellow-500 mr-2" size={24} />
        <h3 className="text-lg font-semibold">Confirm Deletion</h3>
      </div>
      <p className="mb-4">Are you sure you want to delete this order?</p>
      <div className="flex items-center mb-4">
        <Checkbox
          id="confirmDelete"
          checked={deleteConfirmation?.confirmed || false}
          onCheckedChange={(checked) => {
            setDeleteConfirmation((prev) => (prev ? { ...prev, confirmed: checked as boolean } : null))
            setFilteredOrders([...filteredOrders])
          }}
        />
        <label htmlFor="confirmDelete" className="ml-2 text-sm">
          I confirm that I want to delete this order
        </label>
      </div>
      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={() => {
            setDeleteConfirmation(null)
            closeToast()
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            confirmDeleteOrder(orderId)
            closeToast()
          }}
          disabled={!deleteConfirmation?.confirmed}
          className="bg-red-500 text-white hover:bg-red-600"
        >
          Delete
        </Button>
      </div>
      <button onClick={closeToast} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
        <X size={18} />
      </button>
    </div>
  )

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      try {
        const ordersCollection = collection(db, "orders")
        const snapshot = await getDocs(ordersCollection)
        const fetchedOrders = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            // For Visa orders, extract proxyType from orderDetails
            proxyType: data.orderDetails?.proxyType || data.proxyType,
            // For Visa orders, use paymentStatus; for others, use status
            status: data.paymentStatus || data.status || "unknown",
          } as Order
        })
        setOrders(fetchedOrders)
        setFilteredOrders(fetchedOrders)

        const paymentMethods = Array.from(new Set(fetchedOrders.map((order) => order.paymentMethod).filter(Boolean)))
        const productTypes = Array.from(new Set(fetchedOrders.map((order) => order.proxyType).filter(Boolean)))
        setUniquePaymentMethods(paymentMethods as string[])
        setUniqueProductTypes(productTypes as string[])
      } catch (error) {
        console.error("Failed to fetch orders:", error)
        toast.error("Failed to load orders.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [])

  useEffect(() => {
    const filtered = orders.filter((order) => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter

      const orderDate = new Date(order.createdAt)
      const matchesDateFrom = !dateFromFilter || orderDate >= new Date(dateFromFilter)
      const matchesDateTo = !dateToFilter || orderDate <= new Date(dateToFilter + "T23:59:59")

      const matchesPaymentMethod = paymentMethodFilter === "all" || order.paymentMethod === paymentMethodFilter

      const matchesProductType = productTypeFilter === "all" || order.proxyType === productTypeFilter

      return (
        matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && matchesPaymentMethod && matchesProductType
      )
    })
    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, dateFromFilter, dateToFilter, paymentMethodFilter, productTypeFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="warning">Pending</Badge>
      case "not-paid":
        return <Badge variant="destructive">Not Paid</Badge>
      case "paid":
        return <Badge variant="success">Paid</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const handleDeleteOrder = (orderId: string) => {
    setDeleteConfirmation({ orderId, confirmed: false })
    toast.warn(({ closeToast }: ToastContentProps) => <CustomToast closeToast={closeToast} orderId={orderId} />, {
      position: "top-center",
      autoClose: false,
      hideProgressBar: true,
      closeOnClick: false,
      pauseOnHover: true,
      draggable: false,
      progress: undefined,
      closeButton: false,
    })
  }

  const confirmDeleteOrder = async (orderId: string) => {
    if (!deleteConfirmation?.confirmed) return

    try {
      const orderDoc = doc(db, "orders", orderId)
      await deleteDoc(orderDoc)

      setOrders(orders.filter((order) => order.id !== orderId))
      setFilteredOrders(filteredOrders.filter((order) => order.id !== orderId))

      toast.success("Order deleted successfully.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      })
    } catch (error) {
      console.error("Failed to delete order:", error)
      toast.error("Failed to delete order.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      })
    } finally {
      setDeleteConfirmation(null)
    }
  }

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedOrder(null)
  }

  const handleFulfillOrder = (order: Order) => {
    const isSpecial = order.orderDetails?.isSpecialProxy || order.isSpecialProxy
    if (isSpecial) {
      router.push(`/admin/orders/fulfill-special-proxy?id=${order.id}`)
    } else {
      router.push(`/admin/orders/fulfill-order?id=${order.id}`)
    }
  }

  const handleResetFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setDateFromFilter("")
    setDateToFilter("")
    setPaymentMethodFilter("all")
    setProductTypeFilter("all")
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <ToastContainer />
      <h1 className="text-3xl font-bold mb-6">All User Orders</h1>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4 items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="not-paid">Not Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Date From:</label>
            <Input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Date To:</label>
            <Input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="w-[150px]"
            />
          </div>

          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Methods</SelectItem>
              {uniquePaymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Product Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Product Types</SelectItem>
              {uniqueProductTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleResetFilters} className="ml-auto bg-transparent">
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Order ID</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Product Type</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Total Price</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{order.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{order.proxyType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  ${(order.totalAmount || order.totalPrice || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(order.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewDetails(order)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteOrder(order.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedOrder && (
        <Modal isOpen={showModal} onClose={closeModal} title="Order Details">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <p>
              <strong>Order ID:</strong> {selectedOrder.id}
            </p>
            <p>
              <strong>Product Type:</strong> {selectedOrder.proxyType}
            </p>
            <p>
              <strong>Total Price:</strong> ${(selectedOrder.totalAmount || selectedOrder.totalPrice || 0).toFixed(2)}
            </p>
            <p>
              <strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}
            </p>
            <p>
              <strong>Status:</strong> {selectedOrder.status}
            </p>
            <p>
              <strong>Payment Method:</strong> {selectedOrder.paymentMethod}
            </p>

            {selectedOrder.paymentMethod === "visa" && selectedOrder.orderDetails ? (
              <>
                <hr className="my-3" />
                <p className="font-semibold text-gray-700">Visa Order Details:</p>
                {selectedOrder.orderDetails.isSpecialProxy ? (
                  <>
                    <p>
                      <strong>Location:</strong> {selectedOrder.orderDetails.location || "N/A"}
                    </p>
                    <p>
                      <strong>Duration:</strong> {selectedOrder.orderDetails.duration || "N/A"}
                    </p>
                    <p>
                      <strong>Proxy Count:</strong> {selectedOrder.orderDetails.quantity || "N/A"}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>GB Amount:</strong> {selectedOrder.orderDetails.gbAmount || "N/A"}
                    </p>
                    <p>
                      <strong>Additional GB:</strong> {selectedOrder.orderDetails.additionalGb || "N/A"}
                    </p>
                    <p>
                      <strong>Selected Tier:</strong>{" "}
                      {selectedOrder.orderDetails.selectedTier
                        ? `${selectedOrder.orderDetails.selectedTier.gb}GB - $${selectedOrder.orderDetails.selectedTier.price}/GB`
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Payment Option:</strong> {selectedOrder.orderDetails.paymentOption || "N/A"}
                    </p>
                  </>
                )}
                {selectedOrder.dodoProductId && (
                  <p>
                    <strong>DodoPayments Product ID:</strong> {selectedOrder.dodoProductId}
                  </p>
                )}
              </>
            ) : (
              <>
                {selectedOrder.isSpecialProxy ? (
                  <>
                    <p>
                      <strong>Location:</strong> {selectedOrder.location || "N/A"}
                    </p>
                    <p>
                      <strong>Duration:</strong> {selectedOrder.duration || "N/A"}
                    </p>
                    <p>
                      <strong>Proxy Count:</strong> {selectedOrder.proxyCount || "N/A"}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>GB Amount:</strong> {selectedOrder.gbAmount || "N/A"}
                    </p>
                    <p>
                      <strong>Additional GB:</strong> {selectedOrder.additionalGb || "N/A"}
                    </p>
                    <p>
                      <strong>Selected Tier:</strong>
                      {selectedOrder.selectedTier
                        ? ` ${selectedOrder.selectedTier.gb}GB - $${selectedOrder.selectedTier.price}/GB (${selectedOrder.selectedTier.discount} discount)`
                        : " N/A"}
                    </p>
                    <p>
                      <strong>Payment Option:</strong> {selectedOrder.paymentOption || "N/A"}
                    </p>
                  </>
                )}
              </>
            )}

            <hr className="my-3" />
            <p>
              <strong>Referred By:</strong> {selectedOrder.referredBy || "N/A"}
            </p>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={closeModal}>
              Close
            </Button>
            <Button onClick={() => handleFulfillOrder(selectedOrder)}>Fulfill Order</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
