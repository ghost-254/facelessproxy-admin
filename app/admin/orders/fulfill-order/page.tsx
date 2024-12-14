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

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;

      try {
        const orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (orderDoc.exists()) {
          const orderData = orderDoc.data() as Order;
          setOrder({ ...orderData, id: orderDoc.id });
          
          // Initialize proxy details for each location
          const initialProxyDetails: { [key: string]: ProxyDetails } = {};
          orderData.locations.forEach((_, index) => {
            initialProxyDetails[`location${index + 1}`] = {
              ip: '',
              port: HTTP_HTTPS_PORTS[0],
              username: '',
              password: '',
              protocol: 'http',
            };
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

  const handleFulfillOrder = async () => {
    if (!order) return;

    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'fulfilled',
        proxyDetails: proxyDetails,
        fulfilledAt: new Date().toISOString(),
      });

      // TODO: Implement logic to top up user's account with GB amount

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
    }
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
                <TableCell>{order.gbAmount} GB</TableCell>
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
            <CardTitle>Location {index + 1}</CardTitle>
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

      <Button onClick={handleFulfillOrder} className="mt-6" disabled={isLoading}>
        Fulfill Order
      </Button>
    </div>
  );
}

