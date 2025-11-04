import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Smartphone, Download, Check } from "lucide-react";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for appinstalled event
    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <h1 className="text-2xl font-bold text-primary">RGH – Order Management</h1>
            </Link>
            <nav className="flex gap-4">
              <Button variant="ghost" asChild>
                <Link to="/orders">Orders</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {isInstalled ? (
            <Card className="border-accent">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-accent/10">
                    <Check className="w-8 h-8 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">App Installed!</CardTitle>
                    <CardDescription className="text-base mt-1">
                      RGH Order Management is now installed on your device
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  You can now access the app directly from your home screen anytime.
                </p>
                <Button asChild className="w-full">
                  <Link to="/orders">Go to Orders</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Smartphone className="w-16 h-16 text-primary" />
                  </div>
                </div>
                <h1 className="text-4xl font-bold">Install RGH Orders</h1>
                <p className="text-xl text-muted-foreground">
                  Get the full app experience on your device
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Why Install?</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>Works offline - Access your orders even without internet</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>Faster loading - App files cached on your device</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>Home screen access - Launch like a native app</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>Push notifications - Get updates on order status</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>No app store required - Install directly from browser</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {deferredPrompt ? (
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleInstallClick}
                >
                  <Download className="w-5 h-5" />
                  Install Now
                </Button>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>How to Install</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">On iPhone/iPad:</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Open this page in Safari</li>
                        <li>Tap the Share button (square with arrow)</li>
                        <li>Scroll down and tap "Add to Home Screen"</li>
                        <li>Tap "Add" to confirm</li>
                      </ol>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2">On Android:</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Open this page in Chrome</li>
                        <li>Tap the menu (three dots)</li>
                        <li>Tap "Add to Home screen" or "Install app"</li>
                        <li>Tap "Add" or "Install" to confirm</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="text-center">
                <Button variant="ghost" asChild>
                  <Link to="/orders">Continue in Browser</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Install;
