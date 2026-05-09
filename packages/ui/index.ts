// shadcn/ui primitives — NovaCal theme
// All components use `transition-none` to avoid CSS transitions conflicting with Framer Motion spring animations.
// Colors reference CSS variables from the theme (--background, --surface, --primary-accent, etc.).

// Button
export { Button, buttonVariants } from "./button"
export type { ButtonProps } from "./button"

// Input
export { Input } from "./input"
export type { InputProps } from "./input"

// Textarea
export { Textarea } from "./textarea"
export type { TextareaProps } from "./textarea"

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog"

// Popover
export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "./popover"

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./select"

// DropdownMenu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu"

// Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./avatar"

// Badge
export { Badge, badgeVariants } from "./badge"
export type { BadgeProps } from "./badge"

// Switch
export { Switch } from "./switch"

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table"

// ScrollArea
export { ScrollArea, ScrollBar } from "./scroll-area"

// Skeleton
export { Skeleton } from "./skeleton"

// Toast / Sonner
export { Toaster } from "./toast"

// Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip"

// Command
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./command"
