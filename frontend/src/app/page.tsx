import { Header } from "@/components/sections/header";
import { Hero } from "@/components/sections/hero";
import { ProductShowcase } from "@/components/sections/product-showcase";
import { Problem } from "@/components/sections/problem";
import { Workflow } from "@/components/sections/workflow";
import { InsideAria } from "@/components/sections/inside-aria";
import { Features } from "@/components/sections/features";
import { Dashboard } from "@/components/sections/dashboard";
import { Expert } from "@/components/sections/expert";
import { Security } from "@/components/sections/security";
import { Contact } from "@/components/sections/contact";
import { Footer } from "@/components/sections/footer";

export default function LandingPage() {
  return (
    <div className="aria-scope flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <ProductShowcase />
        <Problem />
        <Workflow />
        <InsideAria />
        <Features />
        <Dashboard />
        <Expert />
        <Security />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
