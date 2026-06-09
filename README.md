# Faculty Laptop Reservation System

A web-based system for managing faculty laptop reservations, enabling easy booking and tracking of shared institutional devices.

## Features

- 📅 **Reservation Management** - Book, view, and manage laptop reservations
- 👥 **User Access Control** - Faculty authentication and role-based permissions
- 📊 **Availability Tracking** - Real-time laptop availability status
- 🔔 **Notifications** - Reservation confirmations and reminders
- 📱 **Responsive Design** - Works across desktop and mobile devices

## Tech Stack

- **Frontend:** JavaScript (70.8%), CSS (25.5%), HTML (2.9%)
- **Backend:** JavaScript/Node.js
- **Shell Scripts:** DevOps & deployment (0.8%)

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/pushpullleg/laptop-reservation.git
cd laptop-reservation

# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
├── public/              # Static files
├── src/                 # Source code
│   ├── components/      # React/Vue components
│   ├── pages/           # Application pages
│   └── styles/          # CSS stylesheets
├── backend/             # Server-side code
├── config/              # Configuration files
└── README.md            # This file
```

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Contribution Tracking

**Contribution #1**
- **Student:** Mukesh Ravichandran
- **Status:** [Phase I / Phase II / Phase III / Phase IV] [In Progress]
- **Issue:** [GitHub issue link]
- **Documentation:** [Update with contribution details as work progresses]

## Usage

### For Faculty
1. Log in with institutional credentials
2. View available laptops and dates
3. Select desired reservation period
4. Confirm booking

### For Administrators
1. Access admin dashboard
2. Manage laptop inventory
3. View reservation analytics
4. Handle cancellations and issues

## Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Admin Guide](docs/ADMIN_GUIDE.md)
- [API Reference](docs/API.md)
- [Development Guide](docs/DEVELOPMENT.md)

## Troubleshooting

**Issue:** Application won't start
- Ensure Node.js is installed: `node --version`
- Clear cache and reinstall: `rm -rf node_modules package-lock.json && npm install`

**Issue:** Port 3000 already in use
- Change port: `PORT=3001 npm start`

## License

[Add your license here - e.g., MIT, GPL, etc.]

## Support

For issues, questions, or suggestions, please open a [GitHub Issue](https://github.com/pushpullleg/laptop-reservation/issues).

## Team

- Faculty advisors and student contributors

---

**Last Updated:** June 2026
