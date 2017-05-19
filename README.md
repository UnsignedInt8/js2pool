# A Decentralized Mining Pool - Js2Pool

The new generation P2Pool by Node.js

## Prerequisites
1. Node.js v6.0+
2. Node-gyp v3.6+
3. 2 GB+ Free Mem
4. Linux/macOS x64/x86

## Installation
1. Node.js, node-gyp and TypeScript

```
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
sudo apt-get install -y nodejs

# Using Debian, as root
curl -sL https://deb.nodesource.com/setup_7.x | bash -
apt-get install -y nodejs

# Using CentOS 6/RHEL 6
curl -sL https://rpm.nodesource.com/setup_7.x | bash -
yum install -y nodejs

# Using macOS
brew install node

# More Node.js installation info, please visit https://github.com/nodesource/distributions or https://nodejs.org/en/download/package-manager

# node-gyp
npm i -g node-gyp

# Typescript
npm i -g typescript

```
2. Installing Js2Pool from source
```
git clone https://github.com/unsignedint8/js2pool.git && cd js2pool

# Install dependencies
npm update

# Compile the TypeScript code
tsc -p .

# Link executable files
npm link
```

## Usage

This project has not been finished yet, so it is not usable at the moment. Coming soon...

## Known issues

1. SHA256 Performance (I'm trying to rewrite SHA256 by using Node.js C++ module, but I don't know much about C++. So, to implement it may take me a long time)
2. Weights calculation may have a problem, if total weight exceeds the desired weight. (https://github.com/unsignedint8/js2pool/p2pool/chain/PaymentCalculator.ts#L61-L67)

## Donation

Even if you do not donate anything to me, I'm maintaining this project. :p

```
BTC: 1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9
```


## License
GPL v3.0