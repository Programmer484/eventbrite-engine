import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Eventbrite private token is required in Authorization header' }, { status: 400 });
    }
    const token = authHeader.split(' ')[1];

    const body = await request.json();
    const {
      name,
      description,
      start_utc,
      start_timezone,
      end_utc,
      end_timezone,
      currency,
      is_online,
      venue_details,
      ticket_type,
      ticket_price
    } = body;

    // 1. Fetch Organization ID
    const orgRes = await fetch('https://www.eventbriteapi.com/v3/users/me/organizations/', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!orgRes.ok) {
      const err = await orgRes.json().catch(() => ({}));
      return NextResponse.json({ error: 'Failed to fetch Eventbrite organization', details: err }, { status: orgRes.status });
    }

    const orgData = await orgRes.json();
    if (!orgData.organizations || orgData.organizations.length === 0) {
      return NextResponse.json({ error: 'No Eventbrite organizations found for this account' }, { status: 404 });
    }

    const organizationId = orgData.organizations[0].id;

    // 2. Handle Venue (if physical)
    let venueId = null;
    if (!is_online && venue_details) {
      const venueRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/venues/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          venue: {
            name: venue_details.split(',')[0] || 'Venue',
            address: {
              address_1: venue_details,
              city: 'Calgary', // Reasonable default to avoid API rejections
              country: 'CA'     // Default CA for CAD
            }
          }
        })
      });

      if (venueRes.ok) {
        const venueData = await venueRes.json();
        venueId = venueData.id;
      } else {
        const err = await venueRes.json().catch(() => ({}));
        console.warn('Venue creation failed, proceeding without venue ID', err);
      }
    }

    // Convert date string from local HTML format (YYYY-MM-DDTHH:MM) back to ISO 8601 UTC required by Eventbrite
    const toISODate = (dateTimeLocal: string) => {
      try {
        const date = new Date(dateTimeLocal);
        return date.toISOString().split('.')[0] + 'Z';
      } catch {
        return dateTimeLocal + ':00Z';
      }
    };

    // 3. Create Draft Event
    const eventPayload: any = {
      event: {
        name: { html: name },
        description: { html: description },
        start: {
          timezone: start_timezone,
          utc: toISODate(start_utc)
        },
        end: {
          timezone: end_timezone,
          utc: toISODate(end_utc)
        },
        currency: currency,
        online_event: is_online
      }
    };

    if (venueId) {
      eventPayload.event.venue_id = venueId;
    }

    const createRes = await fetch(`https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return NextResponse.json({ 
        error: 'Failed to create draft event', 
        details: err.error_description || err.error || err 
      }, { status: createRes.status });
    }

    const eventData = await createRes.json();
    const eventId = eventData.id;

    // 4. Create Ticket Class
    const isFree = ticket_type === 'free';
    const ticketPayload: any = {
      ticket_class: {
        name: 'General Admission',
        free: isFree,
        quantity_total: 100 // Standard fallback
      }
    };

    if (!isFree) {
      // Eventbrite format for cost: "CAD,1000" is $10.00
      const amountInCents = Math.round((ticket_price || 0) * 100);
      ticketPayload.ticket_class.cost = `${currency},${amountInCents}`;
    }

    const ticketRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketPayload)
    });

    if (!ticketRes.ok) {
      const err = await ticketRes.json().catch(() => ({}));
      return NextResponse.json({ 
        error: 'Failed to create ticket class for the event', 
        details: err.error_description || err.error || err 
      }, { status: ticketRes.status });
    }

    // 5. Publish Event
    const publishRes = await fetch(`https://www.eventbriteapi.com/v3/events/${eventId}/publish/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!publishRes.ok) {
      const err = await publishRes.json().catch(() => ({}));
      return NextResponse.json({
        error: 'Event created but failed to publish. Check your Eventbrite dashboard to publish manually.',
        details: err.error_description || err.error || err,
        event_url: eventData.url,
        partially_completed: true
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      event_url: eventData.url,
      event_id: eventId
    });

  } catch (error: any) {
    console.error("Create event route error:", error);
    return NextResponse.json({ error: error.message || 'Internal server error during event creation' }, { status: 500 });
  }
}
