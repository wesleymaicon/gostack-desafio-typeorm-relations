import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer does not exists');
    }

    const productsExists = await this.productsRepository.findAllById(products);

    if (!productsExists.length) {
      throw new AppError('Products does not exists');
    }

    const productsIds = productsExists.map(product => product.id);

    const invalidProducts = products.filter(
      product => !productsIds.includes(product.id),
    );

    if (invalidProducts.length) {
      throw new AppError(`Product ${invalidProducts[0]} does not exists`);
    }

    const productsWithInsuficientQuantity = products.filter(
      product =>
        productsExists.filter(prod => prod.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithInsuficientQuantity.length) {
      throw new AppError(
        `Not enough quantity available for product ${productsWithInsuficientQuantity[0]}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,
    });

    const productsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsExists.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(productsQuantity);

    return order;
  }
}

export default CreateOrderService;
