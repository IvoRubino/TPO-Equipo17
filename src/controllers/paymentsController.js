const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createCheckoutSession = async (req, res) => {
  const { servicio_id } = req.body;
  const user = req.user; // Cliente autenticado

  try {
    // Obtener datos del servicio
    const [rows] = await pool.query(`
      SELECT s.id, s.precio, s.descripcion, u.id AS entrenador_id
      FROM servicios s
      JOIN usuarios u ON s.entrenador_id = u.id
      WHERE s.id = ? AND s.estado = 'publicado'
    `, [servicio_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Service not found or unavailable' });
    }

    const servicio = rows[0];

    // Crear la sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Contratación de servicio',
            description: servicio.descripcion
          },
          unit_amount: servicio.precio * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:5173/payment-success',
      cancel_url: 'http://localhost:5173/payment-cancel',
      metadata: {
        cliente_id: user.id,
        servicio_id: servicio.id,
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.webhookStripe = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const cliente_id = session.metadata.cliente_id;
    const servicio_id = session.metadata.servicio_id;

    try {
      // Verificar si ya existe una contratación idéntica pendiente
      const [exist] = await pool.query(
        'SELECT * FROM contrataciones WHERE cliente_id = ? AND servicio_id = ? AND estado = "pendiente"',
        [cliente_id, servicio_id]
      );

      if (exist.length > 0) {
        console.log('🔁 Contratación pendiente ya existente. No se duplicó.');
      } else {
        await pool.query(
          `INSERT INTO contrataciones (cliente_id, servicio_id)
           VALUES (?, ?)`,
          [cliente_id, servicio_id]
        );
        console.log('✅ Contratación creada');
      }

      res.json({ received: true });
    } catch (err) {
      console.error('❌ Error al crear contratación:', err);
      res.status(500).send('Database error');
    }
  } else {
    res.json({ received: true });
  }
};