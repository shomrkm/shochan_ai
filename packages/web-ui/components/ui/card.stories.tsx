import type { Meta, StoryObj } from '@storybook/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from './card'
import { Button } from './button'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content area. You can put any content here.</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Action</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardContent>
        <p>Simple card with just content.</p>
      </CardContent>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Mark all as read
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">New message from Alice</p>
              <p className="text-sm text-muted-foreground">2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">Task completed</p>
              <p className="text-sm text-muted-foreground">1 hour ago</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
}

export const Form: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Enter your details below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              placeholder="Enter your name"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="m@example.com"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button className="flex-1">Create</Button>
      </CardFooter>
    </Card>
  ),
}

export const MultipleCards: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Card 1</CardTitle>
          <CardDescription>First card description</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Content for the first card.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card 2</CardTitle>
          <CardDescription>Second card description</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Content for the second card.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card 3</CardTitle>
          <CardDescription>Third card description</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Content for the third card.</p>
        </CardContent>
      </Card>
    </div>
  ),
}
