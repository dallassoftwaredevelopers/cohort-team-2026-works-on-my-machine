import Link from "next/link";

export default function Home() {
  return (
    <>
      <p>Home Page TBD</p>
      <Link href="/invoices/new" className="btn btn-primary">
        New Invoice
      </Link>
      <Link href="/users/new" className="btn btn-primary">
        Add User
      </Link>
      <Link href="/properties" className="btn btn-primary">
        Manage Properties
      </Link>
      <Link href="/vendors" className="btn btn-primary">
        Manage Vendors
      </Link>
      <Link href="/reset-password" className="btn btn-primary">
        Reset Password
      </Link>
    </>
  );
}
