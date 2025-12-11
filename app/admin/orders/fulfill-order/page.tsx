//app/admin/orders/fulfill-order/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Location {
  country: string;
  state: string;
  city: string;
  zipcode: string;
}

interface Order {
  id: string;
  status: string;
  proxyType: string;
  gbAmount: number;
  locations: Location[];
  totalPrice: number;
  createdAt: string;
  paymentOption: string;
  proxyDetails?: { [key: string]: ProxyDetails };
}

interface ProxyDetails {
  ip: string;
  port: string;
  username: string;
  password: string;
  protocol: 'http' | 'https' | 'socks5';
}

const SOCKS5_PORTS = ['10000', '10001', '10002', '10003', '10004', '10005', '10006', '10007', '10008']
const HTTP_HTTPS_PORTS = ['10000', '10001', '10002', '10003', '10004', '10005', '10006', '10007', '10008']

export default function FulfillOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<Order | null>(null);
  const [proxyDetails, setProxyDetails] = useState<{ [key: string]: ProxyDetails }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newLocation, setNewLocation] = useState<Location>({ country: '', state: '', city: '', zipcode: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<number | null>(null);
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [fulfillConfirmed, setFulfillConfirmed] = useState(false);
  const [updatedGbAmount, setUpdatedGbAmount] = useState<number | ''>('');

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;

      try {
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as Order;
          setOrder({ ...orderData, id: orderDoc.id });
          setUpdatedGbAmount(orderData.gbAmount);
          
          // Initialize proxy details for each location, using existing details if available
          const initialProxyDetails: { [key: string]: ProxyDetails } = {};
          orderData.locations.forEach((_, index) => {
            const locationKey = `location${index + 1}`;
            if (orderData.proxyDetails && orderData.proxyDetails[locationKey]) {
              initialProxyDetails[locationKey] = orderData.proxyDetails[locationKey];
            } else {
              initialProxyDetails[locationKey] = {
                ip: '',
                port: HTTP_HTTPS_PORTS[0],
                username: '',
                password: '',
                protocol: 'http',
              };
            }
          });
          setProxyDetails(initialProxyDetails);
        } else {
          toast({
            title: 'Error',
            description: 'Order not found',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast({
          title: 'Error',
          description: 'Failed to load order details',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleProxyDetailChange = (locationKey: string, field: keyof ProxyDetails, value: string) => {
    setProxyDetails(prev => ({
      ...prev,
      [locationKey]: {
        ...prev[locationKey],
        [field]: value,
      },
    }));

    // Update port options when protocol changes
    if (field === 'protocol') {
      const newPort = value === 'socks5' ? SOCKS5_PORTS[0] : HTTP_HTTPS_PORTS[0];
      setProxyDetails(prev => ({
        ...prev,
        [locationKey]: {
          ...prev[locationKey],
          port: newPort,
        },
      }));
    }
  };

  const handleFulfillOrder = () => {
    setFulfillDialogOpen(true);
    setFulfillConfirmed(false);
  };

  const confirmFulfillOrder = async () => {
    if (!order || !fulfillConfirmed) return;

    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'fulfilled',
        proxyDetails: proxyDetails,
        fulfilledAt: new Date().toISOString(),
        locations: order.locations,
        gbAmount: updatedGbAmount,
      });

      toast({
        title: 'Success',
        description: 'Order fulfilled successfully',
      });

      router.push('/admin/orders');
    } catch (error) {
      console.error('Error fulfilling order:', error);
      toast({
        title: 'Error',
        description: 'Failed to fulfill order',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setFulfillDialogOpen(false);
      setFulfillConfirmed(false);
    }
  };

  const handleAddLocation = () => {
    if (!order) return;

    const updatedLocations = [...order.locations, newLocation];
    setOrder({ ...order, locations: updatedLocations });

    const newIndex = updatedLocations.length;
    setProxyDetails(prev => ({
      ...prev,
      [`location${newIndex}`]: {
        ip: '',
        port: HTTP_HTTPS_PORTS[0],
        username: '',
        password: '',
        protocol: 'http',
      },
    }));

    setNewLocation({ country: '', state: '', city: '', zipcode: '' });

    toast({
      title: 'Success',
      description: 'New location added',
    });
  };

  const handleDeleteLocation = (index: number) => {
    setLocationToDelete(index);
    setDeleteDialogOpen(true);
    setDeleteConfirmed(false);
  };

  const confirmDeleteLocation = () => {
    if (!order || locationToDelete === null || !deleteConfirmed) return;

    const updatedLocations = order.locations.filter((_, i) => i !== locationToDelete);
    setOrder({ ...order, locations: updatedLocations });

    const updatedProxyDetails = { ...proxyDetails };
    delete updatedProxyDetails[`location${locationToDelete + 1}`];
    setProxyDetails(updatedProxyDetails);

    toast({
      title: 'Success',
      description: 'Location deleted',
    });

    setDeleteDialogOpen(false);
    setLocationToDelete(null);
    setDeleteConfirmed(false);
  };

  const handleNewLocationChange = (field: keyof Location, value: string) => {
    setNewLocation(prev => ({ ...prev, [field]: value }));
  };

  const handleGbAmountChange = (value: string) => {
    const numValue = parseFloat(value);
    setUpdatedGbAmount(isNaN(numValue) ? '' : numValue);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!order) {
    return <div>Order not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Fulfill Order: {order.id}</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
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
                <TableCell className="font-medium">GB Amount</TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={updatedGbAmount}
                      onChange={(e) => handleGbAmountChange(e.target.value)}
                      className="w-24"
                    />
                    <span>GB</span>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Payment Option</TableCell>
                <TableCell>{order.paymentOption}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Order Date</TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Total Price</TableCell>
                <TableCell>${order.totalPrice.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.locations.map((location, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Location {index + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteLocation(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{location.city}, {location.state}, {location.country} {location.zipcode}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`protocol-${index}`}>Protocol</Label>
                <Select
                  value={proxyDetails[`location${index + 1}`].protocol}
                  onValueChange={(value: 'http' | 'https' | 'socks5') => handleProxyDetailChange(`location${index + 1}`, 'protocol', value)}
                >
                  <SelectTrigger id={`protocol-${index}`}>
                    <SelectValue placeholder="Select protocol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`port-${index}`}>Port</Label>
                <Select
                  value={proxyDetails[`location${index + 1}`].port}
                  onValueChange={(value) => handleProxyDetailChange(`location${index + 1}`, 'port', value)}
                >
                  <SelectTrigger id={`port-${index}`}>
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    {(proxyDetails[`location${index + 1}`].protocol === 'socks5' ? SOCKS5_PORTS : HTTP_HTTPS_PORTS).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`ip-${index}`}>IP Address</Label>
                <Input
                  id={`ip-${index}`}
                  value={proxyDetails[`location${index + 1}`].ip}
                  onChange={(e) => handleProxyDetailChange(`location${index + 1}`, 'ip', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`username-${index}`}>Username</Label>
                <Input
                  id={`username-${index}`}
                  value={proxyDetails[`location${index + 1}`].username}
                  onChange={(e) => handleProxyDetailChange(`location${index + 1}`, 'username', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`password-${index}`}>Password</Label>
                <Input
                  id={`password-${index}`}
                  type="password"
                  value={proxyDetails[`location${index + 1}`].password}
                  onChange={(e) => handleProxyDetailChange(`location${index + 1}`, 'password', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Add New Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="new-country">Country</Label>
              <Input
                id="new-country"
                value={newLocation.country}
                onChange={(e) => handleNewLocationChange('country', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-state">State</Label>
              <Input
                id="new-state"
                value={newLocation.state}
                onChange={(e) => handleNewLocationChange('state', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-city">City</Label>
              <Input
                id="new-city"
                value={newLocation.city}
                onChange={(e) => handleNewLocationChange('city', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-zipcode">Zipcode</Label>
              <Input
                id="new-zipcode"
                value={newLocation.zipcode}
                onChange={(e) => handleNewLocationChange('zipcode', e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleAddLocation} className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleFulfillOrder} className="mt-6" disabled={isLoading}>
        {order.status === 'fulfilled' ? 'Re-fulfill Order' : 'Fulfill Order'}
      </Button>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Location Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this location? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm-delete"
              checked={deleteConfirmed}
              onCheckedChange={(checked) => setDeleteConfirmed(checked as boolean)}
            />
            <label
              htmlFor="confirm-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I confirm that I want to delete this location
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteLocation}
              disabled={!deleteConfirmed}
            >
              Delete Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order Fulfillment</DialogTitle>
            <DialogDescription>
              Please verify that all order details are correct before proceeding with fulfillment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p><strong>Order ID:</strong> {order.id}</p>
            <p><strong>Product:</strong> {order.proxyType}</p>
            <p><strong>GB Amount:</strong> {updatedGbAmount} GB</p>
            <p><strong>Total Price:</strong> ${order.totalPrice.toFixed(2)}</p>
            <p><strong>Locations:</strong> {order.locations.length}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm-fulfill"
              checked={fulfillConfirmed}
              onCheckedChange={(checked) => setFulfillConfirmed(checked as boolean)}
            />
            <label
              htmlFor="confirm-fulfill"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I confirm that all order details are correct and I want to fulfill this order
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmFulfillOrder}
              disabled={!fulfillConfirmed}
            >
              Fulfill Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

