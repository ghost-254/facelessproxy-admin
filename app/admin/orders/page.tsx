//app/admin/orders/page.tsx


'use client';

import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Modal from '@/components/ui/modal';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  status: string;
  createdAt: string;
  proxyType: string;
  paymentMethod: string;
  totalPrice: number;
  location?: string;
  duration?: string;
  proxyCount?: number;
  isSpecialProxy?: boolean;
  gbAmount?: number;
  additionalGb?: number;
  selectedTier?: {
    gb: number;
    discount: string;
    price: number;
  };
  paymentOption?: string;
  referredBy?: string | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const ordersCollection = collection(db, 'orders');
        const snapshot = await getDocs(ordersCollection);
        const fetchedOrders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        setOrders(fetchedOrders);
        setFilteredOrders(fetchedOrders);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        toast({
          title: 'Error',
          description: 'Failed to load orders.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  useEffect(() => {
    const filtered = orders.filter((order) => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'not-paid':
        return <Badge variant="destructive">Not Paid</Badge>;
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const orderDoc = doc(db, 'orders', orderId);
      await deleteDoc(orderDoc);

      setOrders(orders.filter((order) => order.id !== orderId));
      setFilteredOrders(filteredOrders.filter((order) => order.id !== orderId));

      toast({
        title: 'Success',
        description: 'Order deleted successfully.',
      });
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
  };

  const handleFulfillOrder = (order: Order) => {
    if (order.isSpecialProxy) {
      router.push(`/admin/orders/fulfill-special-proxy?id=${order.id}`);
    } else {
      router.push(`/admin/orders/fulfill-order?id=${order.id}`);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">All User Orders</h1>

      <div className="mb-4 flex gap-4 items-center">
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
                  ${order.totalPrice?.toFixed(2) ?? 'N/A'}
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
          <div className="space-y-2">
            <p><strong>Order ID:</strong> {selectedOrder.id}</p>
            <p><strong>Product Type:</strong> {selectedOrder.proxyType}</p>
            <p><strong>Total Price:</strong> ${selectedOrder.totalPrice ? selectedOrder.totalPrice.toFixed(2) : 'N/A'}</p>
            <p><strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> {selectedOrder.status}</p>
            <p><strong>Payment Method:</strong> {selectedOrder.paymentMethod}</p>
            {selectedOrder.isSpecialProxy ? (
              <>
                <p><strong>Location:</strong> {selectedOrder.location}</p>
                <p><strong>Duration:</strong> {selectedOrder.duration}</p>
                <p><strong>Proxy Count:</strong> {selectedOrder.proxyCount}</p>
              </>
            ) : (
              <>
                <p><strong>GB Amount:</strong> {selectedOrder.gbAmount}</p>
                <p><strong>Additional GB:</strong> {selectedOrder.additionalGb}</p>
                <p><strong>Selected Tier:</strong> {selectedOrder.selectedTier?.gb}GB - ${selectedOrder.selectedTier?.price}/GB ({selectedOrder.selectedTier?.discount} discount)</p>
                <p><strong>Payment Option:</strong> {selectedOrder.paymentOption}</p>
              </>
            )}
            <p><strong>Referred By:</strong> {selectedOrder.referredBy || 'N/A'}</p>
          </div>
          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={closeModal}>
              Close
            </Button>
            <Button onClick={() => handleFulfillOrder(selectedOrder)}>
              Fulfill Order
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

